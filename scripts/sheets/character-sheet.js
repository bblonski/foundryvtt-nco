import { Tags, TAG_POLARITY } from "../tags.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);

/** Fixed number of boxes on the Drive track. */
const DRIVE_TRACK_LENGTH = 10;
/** Drive box state values (index) mapped to their CSS state name. */
const DRIVE_STATES = ["empty", "ticked", "crossed"];

/**
 * Character sheet for Neon City Overdrive characters.
 *
 * Trademarks are embedded Items, edited in their own sheet and droppable onto
 * the character (ActorSheetV2's default item-drop handling embeds them).
 *
 * Has two modes per open sheet:
 *  - Edit mode: name and description are form inputs, with controls to add,
 *    open, and remove Trademarks, and to manage Flaws, Traumas and Conditions.
 *  - Play mode (default once the character has content): Trademarks and
 *    Triggers render as labels. Clicking a Tag (a Trademark name, an Edge, a
 *    Flaw, Trauma, or Condition) sends it to the shared roll pool — positive
 *    Tags as Action dice, negative Tags as Danger dice, identically for GMs
 *    and players. Shift-clicking inverts the polarity. Plain Triggers are not
 *    Tags and are not clickable.
 */
export class CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "actor"],
    position: { width: 480, height: 640 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: this._onEditImage,
      toggleEdit: this._onToggleEdit,
      createTrademark: this._onCreateTrademark,
      editTrademark: this._onEditTrademark,
      deleteTrademark: this._onDeleteTrademark,
      invoke: this._onInvoke,
      trackAdd: this._onTrackAdd,
      driveClick: this._onDriveClick,
      spendStuntPoint: this._onSpendStuntPoint,
      toggleCondition: this._onToggleCondition,
      createCondition: this._onCreateCondition,
      deleteCondition: this._onDeleteCondition,
      createTrauma: this._onCreateTrauma,
      deleteTrauma: this._onDeleteTrauma,
      createUniqueGear: this._onCreateUniqueGear,
      editUniqueGear: this._onEditUniqueGear,
      deleteUniqueGear: this._onDeleteUniqueGear,
    },
  };

  static PARTS = {
    sheet: { template: "systems/foundryvtt-nco/templates/actor/character-sheet.hbs" },
  };

  /**
   * Whether this sheet is currently in edit mode. Starts in edit mode for a
   * blank character so there is something to interact with, otherwise in
   * play mode so Trademarks and Edges are immediately clickable.
   * @type {boolean|undefined}
   */
  _editing;

  get isEditing() {
    this._editing ??= !this.#trademarkItems.length;
    return this._editing && this.isEditable;
  }

  /** The character's embedded Trademark Items. */
  get #trademarkItems() {
    return this.actor.items.filter((item) => item.type === "trademark");
  }

  /** The character's embedded Unique Gear Items. */
  get #gearItems() {
    return this.actor.items.filter((item) => item.type === "gear");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const TextEditorImpl = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;

    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      editing: this.isEditing,
      editable: this.isEditable,
      // In play mode a Trademark name is a positive Tag (always clickable when
      // named); a Trigger is only a Tag — and so only clickable — once it is an
      // Edge. Plain Triggers add no dice and render as static labels.
      trademarks: this.#trademarkItems.map((item) => ({
        id: item.id,
        name: item.name,
        clickable: !!item.name?.trim(),
        triggers: (item.system.triggers ?? []).map((trigger) => ({
          text: trigger.text,
          edge: trigger.edge,
          clickable: !!trigger.text?.trim() && trigger.edge,
        })),
      })),
      hitBoxes: this.#prepareHitBoxes(),
      xpGroups: this.#prepareXpGroups(),
      driveEnabled: game.settings.get("foundryvtt-nco", "driveTrackEnabled"),
      driveBoxes: this.#prepareDriveBoxes(),
      driveHint: game.i18n.localize("NCO.Sheet.DriveHint"),
      trackHint: game.i18n.localize(
        game.settings.get("foundryvtt-nco", "trackClickMode") === "fill"
          ? "NCO.Sheet.TrackHintFill"
          : "NCO.Sheet.TrackHintIncrement",
      ),
      conditions: this.actor.items
        .filter((item) => item.type === "condition")
        .map((item) => ({ id: item.id, name: item.name, active: !!item.system.active })),
      hitsMaxLimit: game.settings.get("foundryvtt-nco", "maxHits"),
      // Exactly two Flaw slots, regardless of what older documents stored.
      flaws: Array.from({ length: 2 }, (_, i) => {
        const text = this.actor.system.flaws?.[i] ?? "";
        return { text, clickable: !!text.trim() };
      }),
      traumas: (this.actor.system.traumas ?? []).map((text) => ({
        text,
        clickable: !!text?.trim(),
      })),
      // Unique Gear: the Item's name is just a label, not a Tag — only its
      // own Tags (each independently positive or negative) are clickable.
      uniqueGear: this.#gearItems.map((item) => ({
        id: item.id,
        name: item.name,
        tags: (item.system.tags ?? []).map((tag) => ({
          text: tag.text,
          positive: tag.polarity !== TAG_POLARITY.NEGATIVE,
          clickable: !!tag.text?.trim(),
        })),
      })),
      invokePositiveTitle: game.i18n.localize("NCO.Sheet.InvokePositive"),
      invokeNegativeTitle: game.i18n.localize("NCO.Sheet.InvokeNegative"),
      descriptionHTML: await TextEditorImpl.enrichHTML(this.actor.system.description ?? "", {
        relativeTo: this.actor,
      }),
      gearHTML: await TextEditorImpl.enrichHTML(this.actor.system.gear ?? "", {
        relativeTo: this.actor,
      }),
    };
  }

  /** One checkbox per hit, checked from the left as damage is taken. */
  #prepareHitBoxes() {
    const hits = this.actor.system.hits ?? {};
    const max = Math.min(6, Math.max(1, hits.max ?? 3));
    const taken = Math.min(max, hits.taken ?? 0);
    return Array.from({ length: max }, (_, i) => ({ index: i, checked: i < taken }));
  }

  /** The configured XP track length (total boxes), clamped to a sane minimum. */
  get #xpTrackLength() {
    return Math.max(0, game.settings.get("foundryvtt-nco", "xpTrackLength") ?? 15);
  }

  /**
   * The XP track split into groups of five boxes, so the template can draw a
   * horizontal divider between each group. Boxes fill from the left.
   */
  #prepareXpGroups() {
    const length = this.#xpTrackLength;
    const filled = Math.min(length, Math.max(0, this.actor.system.xp ?? 0));
    const groups = [];
    for (let i = 0; i < length; i += 5) {
      groups.push(
        Array.from({ length: Math.min(5, length - i) }, (_, j) => ({
          index: i + j,
          checked: i + j < filled,
        })),
      );
    }
    return groups;
  }

  /**
   * The ten Drive boxes as {index, state} pairs, where state is the CSS state
   * name ("empty", "ticked", or "crossed"). Older documents with a short or
   * missing array fall back to empty.
   */
  #prepareDriveBoxes() {
    const boxes = this.actor.system.drive?.boxes ?? [];
    return Array.from({ length: DRIVE_TRACK_LENGTH }, (_, i) => ({
      index: i,
      state: DRIVE_STATES[boxes[i] ?? 0] ?? "empty",
    }));
  }

  /**
   * Click a Drive box: cycle its tri-state through empty -> ticked -> crossed
   * -> empty. Unlike the Hits/XP tracks, each box is independent rather than a
   * fill level, so the whole array is rewritten with the one box advanced.
   */
  static async _onDriveClick(_event, target) {
    if (!this.isEditable) return;
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= DRIVE_TRACK_LENGTH) return;
    const boxes = Array.from(
      { length: DRIVE_TRACK_LENGTH },
      (_, i) => Number(this.actor.system.drive?.boxes?.[i] ?? 0),
    );
    boxes[index] = (boxes[index] + 1) % 3;
    await this.actor.update({ "system.drive.boxes": boxes });
  }

  /**
   * Where a track's filled-box count is stored and how high it can go. Both the
   * Hits and XP tracks share the same click behavior, differing only in this.
   */
  #trackConfig(track) {
    if (track === "hits") {
      return {
        field: "system.hits.taken",
        current: this.actor.system.hits?.taken ?? 0,
        max: Math.min(6, Math.max(1, this.actor.system.hits?.max ?? 3)),
      };
    }
    return {
      field: "system.xp",
      current: this.actor.system.xp ?? 0,
      max: this.#xpTrackLength,
    };
  }

  /**
   * Left-click a track box. The world's "track click mode" setting decides
   * whether this adds a single box ("increment") or fills/clears up to the
   * clicked box ("fill"). Applies identically to the Hits and XP tracks.
   */
  static async _onTrackAdd(event, target) {
    if (!this.isEditable) return;
    const cfg = this.#trackConfig(target.dataset.track);
    let next;
    if (game.settings.get("foundryvtt-nco", "trackClickMode") === "fill") {
      const box = event.target.closest("[data-index]");
      if (!box) return;
      const index = Number(box.dataset.index);
      // Clicking a filled box clears down to it; an empty box fills up to it.
      next = index < cfg.current ? index : index + 1;
    } else {
      next = cfg.current + 1;
    }
    next = Math.max(0, Math.min(cfg.max, next));
    if (next !== cfg.current) await this.actor.update({ [cfg.field]: next });
  }

  /** Right-click a track: clear the last filled box (only in "increment" mode). */
  async #onTrackRemove(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    if (game.settings.get("foundryvtt-nco", "trackClickMode") !== "increment") return;
    const cfg = this.#trackConfig(event.currentTarget.dataset.track);
    const next = Math.max(0, cfg.current - 1);
    if (next !== cfg.current) await this.actor.update({ [cfg.field]: next });
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    // Right-click isn't an ActionV2 trigger, so wire each track's contextmenu
    // (decrement) manually. The element is rebuilt each render, so re-bind here.
    for (const el of this.element.querySelectorAll(".nco-track")) {
      el.addEventListener("contextmenu", this.#onTrackRemove.bind(this));
    }
  }

  /**
   * Spend a Stunt Point: decrement the pool and post the list of ways the
   * point may be used to chat.
   */
  static async _onSpendStuntPoint(_event, _target) {
    if (!this.isEditable) return;
    const current = this.actor.system.stuntPoints ?? 0;
    if (current <= 0) {
      ui.notifications.warn(game.i18n.format("NCO.Sheet.NoStuntPoints", { name: this.actor.name }));
      return;
    }
    const remaining = current - 1;
    await this.actor.update({ "system.stuntPoints": remaining });

    const options = ["Trademark", "Soak", "Adjust", "Detail"]
      .map((key) => `<li>${game.i18n.localize(`NCO.Chat.StuntPoint.Option${key}`)}</li>`)
      .join("");
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div style="border:1px solid #23d5e5;border-radius:6px;padding:8px 10px;background:rgba(10,12,24,0.55);">
          <div style="font-family:'Courier New',monospace;letter-spacing:1px;color:#23d5e5;font-size:11px;text-transform:uppercase;">
            ${game.i18n.localize("NCO.Chat.StuntPoint.Title")}
          </div>
          <ul style="margin:6px 0;padding-left:18px;font-size:12px;line-height:1.6;">${options}</ul>
          <div style="font-size:11px;opacity:0.7;">
            ${game.i18n.format("NCO.Chat.StuntPoint.Remaining", { name: this.actor.name, remaining })}
          </div>
        </div>`,
    });
  }

  /**
   * Suffer a new Trauma: prompt for a name, add it, then roll a 1d6 death
   * check. On a 1 the character is dying, and a second d6 sets how many
   * turns they have left.
   */
  static async _onCreateTrauma(_event, _target) {
    const placeholder = game.i18n.localize("NCO.Sheet.TraumaNamePlaceholder");
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: "NCO.Sheet.AddTraumaTitle" },
      content: `<input type="text" name="name" placeholder="${placeholder}" autofocus />`,
      rejectClose: false,
      ok: {
        icon: "fas fa-plus",
        label: "NCO.Sheet.AddTrauma",
        callback: (_event, _button, dialog) =>
          dialog.element.querySelector('input[name="name"]')?.value ?? "",
      },
    });
    if (!name?.trim()) return;

    if (this.isEditable) await this.submit();
    const traumas = this.actor.toObject().system.traumas ?? [];
    traumas.push(name.trim());
    await this.actor.update({ "system.traumas": traumas });
    await this.#rollDeathCheck(name.trim());
  }

  static async _onDeleteTrauma(_event, target) {
    const index = Number(target.dataset.traumaIndex);
    if (this.isEditable) await this.submit();
    const traumas = this.actor.toObject().system.traumas ?? [];
    if (index < 0 || index >= traumas.length) return;
    traumas.splice(index, 1);
    await this.actor.update({ "system.traumas": traumas });
  }

  /** Roll the death check for a freshly suffered Trauma and post the outcome. */
  async #rollDeathCheck(trauma) {
    const check = new Roll("1d6");
    await check.evaluate();
    const rolls = [check];

    const suffered = game.i18n.format("NCO.Chat.DeathCheck.Suffered", {
      name: escapeHTML(this.actor.name),
      trauma: escapeHTML(trauma),
    });
    let outcome;
    let outcomeColor = "#23d5e5";
    if (check.total === 1) {
      const turnsRoll = new Roll("1d6");
      await turnsRoll.evaluate();
      rolls.push(turnsRoll);
      outcome = game.i18n.format("NCO.Chat.DeathCheck.Dying", {
        name: escapeHTML(this.actor.name),
        turns: turnsRoll.total,
      });
      outcomeColor = "#ff2e88";
    } else {
      outcome = game.i18n.format("NCO.Chat.DeathCheck.Safe", {
        name: escapeHTML(this.actor.name),
        result: check.total,
      });
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      rolls,
      sound: CONFIG.sounds.dice,
      content: `
        <div style="border:1px solid ${outcomeColor};border-radius:6px;padding:8px 10px;background:rgba(10,12,24,0.55);">
          <div style="font-family:'Courier New',monospace;letter-spacing:1px;color:#23d5e5;font-size:11px;text-transform:uppercase;">
            ${game.i18n.localize("NCO.Chat.DeathCheck.Title")}
          </div>
          <div style="margin:6px 0 2px;font-size:12px;">${suffered}</div>
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);
            font-size:14px;font-weight:bold;color:${outcomeColor};text-align:center;">
            ${outcome}
          </div>
        </div>`,
    });
  }

  /** Mark or unmark a Condition as currently affecting the character. */
  static async _onToggleCondition(_event, target) {
    if (!this.isEditable) return;
    const item = this.actor.items.get(target.dataset.itemId);
    if (item) await item.update({ "system.active": !item.system.active });
  }

  /** Prompt for a name and embed a new (unmarked) Condition on the character. */
  static async _onCreateCondition(_event, _target) {
    const placeholder = game.i18n.localize("NCO.Sheet.ConditionNamePlaceholder");
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: "NCO.Sheet.AddConditionTitle" },
      content: `<input type="text" name="name" placeholder="${placeholder}" autofocus />`,
      rejectClose: false,
      ok: {
        icon: "fas fa-plus",
        label: "NCO.Sheet.AddCondition",
        callback: (_event, _button, dialog) =>
          dialog.element.querySelector('input[name="name"]')?.value ?? "",
      },
    });
    if (!name?.trim()) return;
    await this.actor.createEmbeddedDocuments("Item", [
      { name: name.trim(), type: "condition", img: "icons/svg/downgrade.svg" },
    ]);
  }

  static async _onDeleteCondition(_event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (item) await item.delete();
  }

  /**
   * Click a Tag (a Trademark name, Edge, Flaw, Trauma, or Condition): add it to
   * the shared roll pool and show the roll window. Polarity is intrinsic to the
   * chip and the same for GMs and players — positive Tags add Action dice,
   * negative Tags add Danger dice. Shift-clicking inverts the polarity.
   */
  static async _onInvoke(event, target) {
    await Tags.invoke({
      text: target.dataset.text,
      polarity: target.dataset.polarity ?? TAG_POLARITY.POSITIVE,
      source: this.actor.name,
      invert: event.shiftKey,
    });
  }

  static _onToggleEdit(_event, _target) {
    this._editing = !this.isEditing;
    this.render();
  }

  /** Open a file picker for the character portrait. */
  static async _onEditImage(_event, _target) {
    const FilePickerImpl = foundry.applications.apps?.FilePicker?.implementation ?? FilePicker;
    const picker = new FilePickerImpl({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path }),
    });
    return picker.browse();
  }

  /** Create a fresh embedded Trademark and open its sheet to fill it in. */
  static async _onCreateTrademark(_event, _target) {
    this._editing = true;
    const [item] = await this.actor.createEmbeddedDocuments("Item", [
      { name: game.i18n.localize("NCO.Sheet.NewTrademark"), type: "trademark", img: "icons/svg/upgrade.svg" },
    ]);
    item?.sheet.render(true);
  }

  /** Open an embedded Trademark's own sheet for editing. */
  static _onEditTrademark(_event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    item?.sheet.render(true);
  }

  static async _onDeleteTrademark(_event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;

    // Only prompt when the Trademark actually has content to lose.
    if (item.name?.trim() || item.system.triggers?.length) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: "NCO.Sheet.DeleteTrademark" },
        content: `<p>${game.i18n.localize("NCO.Sheet.DeleteTrademarkConfirm")}</p>`,
      });
      if (!confirmed) return;
    }

    await item.delete();
  }

  /** Create a fresh embedded Unique Gear Item and open its sheet to fill it in. */
  static async _onCreateUniqueGear(_event, _target) {
    this._editing = true;
    const [item] = await this.actor.createEmbeddedDocuments("Item", [
      { name: game.i18n.localize("NCO.Sheet.NewGear"), type: "gear", img: "icons/svg/item-bag.svg" },
    ]);
    item?.sheet.render(true);
  }

  /** Open an embedded Unique Gear Item's own sheet for editing. */
  static _onEditUniqueGear(_event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    item?.sheet.render(true);
  }

  static async _onDeleteUniqueGear(_event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;

    // Only prompt when the Gear actually has content to lose.
    if (item.name?.trim() || item.system.tags?.length) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: "NCO.Sheet.DeleteUniqueGear" },
        content: `<p>${game.i18n.localize("NCO.Sheet.DeleteUniqueGearConfirm")}</p>`,
      });
      if (!confirmed) return;
    }

    await item.delete();
  }
}
