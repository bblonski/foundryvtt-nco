import { NCOSheetMixin } from "./nco-sheet-mixin.js";
import { TAG_POLARITY } from "../tags.js";
import { escapeHTML } from "../lib/lib.js";
import { NCORoll } from "../dice/nco-roll.js";

const { ActorSheetV2 } = foundry.applications.sheets;

/** Fixed number of boxes on the Drive track. */
const DRIVE_TRACK_LENGTH = 10;
/** Absolute ceiling for the Stunt Points track. */
const STUNT_POINTS_MAX = 5;
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
export class CharacterSheet extends NCOSheetMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "actor"],
    // Default to the left side of the screen, clear of the scene controls toolbar.
    position: { width: 820, height: 1100, top: 80, left: 120 },
    resiable: true,
    // Shared actions (editImage, toggleEdit, invoke, trackAdd) come from NCOSheetMixin.
    actions: {
      customRoll: this._onCustomRoll,
      createTrademark: this._onCreateTrademark,
      editTrademark: this._onEditTrademark,
      deleteTrademark: this._onDeleteTrademark,
      driveClick: this._onDriveClick,
      spendStuntPoint: this._onSpendStuntPoint,
      toggleCondition: this._onToggleCondition,
      createCondition: this._onCreateCondition,
      deleteCondition: this._onDeleteCondition,
      createTrauma: this._onCreateTrauma,
      deleteTrauma: this._onDeleteTrauma,
      createAdvantage: this._onCreateAdvantage,
      deleteAdvantage: this._onDeleteAdvantage,
      createUniqueGear: this._onCreateUniqueGear,
      editUniqueGear: this._onEditUniqueGear,
      deleteUniqueGear: this._onDeleteUniqueGear,
    },
  };

  static PARTS = {
    // Preserve the body's scroll position across re-renders (e.g. submitOnChange
    // edits and track clicks that re-render the sheet).
    sheet: {
      template: "systems/foundryvtt-nco/templates/actor/character-sheet.hbs",
      scrollable: [".nco-sheet-body"],
    },
  };

  /**
   * @override Start a Trademark-less character in edit mode so there is
   * something to interact with; otherwise open in play mode so Trademarks and
   * Edges are immediately clickable.
   */
  _startsBlank() {
    return !this.#trademarkItems.length;
  }

  /**
   * Open the direct-count roll prompt (Action/Danger dice) and post the result
   * to chat — a quick custom roll independent of the shared roll pool.
   */
  static _onCustomRoll(_event, _target) {
    return NCORoll.fromDialog({ post: true });
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
      ...this._baseContext(),
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
      stuntBoxes: this.#prepareStuntBoxes(),
      stuntMaxLimit: STUNT_POINTS_MAX,
      xpGroups: this.#prepareXpGroups(),
      stashEnabled: game.settings.get("foundryvtt-nco", "stashTrackEnabled"),
      stashGroups: this.#prepareStashGroups(),
      driveEnabled: game.settings.get("foundryvtt-nco", "driveTrackEnabled"),
      driveBoxes: this.#prepareDriveBoxes(),
      driveHint: game.i18n.localize("NCO.Sheet.DriveHint"),
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
        // A damage track is only present when the Gear was given a length (>0).
        hitBoxes: this.#prepareGearHitBoxes(item),
        tags: (item.system.tags ?? []).map((tag) => ({
          text: tag.text,
          positive: tag.polarity !== TAG_POLARITY.NEGATIVE,
          clickable: !!tag.text?.trim(),
        })),
      })),
      descriptionHTML: await TextEditorImpl.enrichHTML(this.actor.system.description ?? "", {
        relativeTo: this.actor,
      }),
      gearHTML: await TextEditorImpl.enrichHTML(this.actor.system.gear ?? "", {
        relativeTo: this.actor,
      }),
      tiesEnabled: game.settings.get("foundryvtt-nco", "tiesEnabled"),
      tiesHTML: await TextEditorImpl.enrichHTML(this.actor.system.ties ?? "", {
        relativeTo: this.actor,
      }),
      advantagesEnabled: game.settings.get("foundryvtt-nco", "advantagesEnabled"),
      // Open-ended list of positive Tags, mirroring `traumas` (which are negative).
      advantages: (this.actor.system.advantages ?? []).map((text) => ({
        text,
        clickable: !!text?.trim(),
      })),
    };
  }

  /** One checkbox per hit, checked from the left as damage is taken. */
  #prepareHitBoxes() {
    const hits = this.actor.system.hits ?? {};
    const max = Math.min(6, Math.max(1, hits.max ?? 3));
    const taken = Math.min(max, hits.taken ?? 0);
    return Array.from({ length: max }, (_, i) => ({ index: i, checked: i < taken }));
  }

  /**
   * A Unique Gear item's optional damage track, as {index, checked} boxes —
   * or null when the Gear has no track (length 0), so the template can omit it.
   */
  #prepareGearHitBoxes(item) {
    const hits = item.system.hits ?? {};
    const max = Math.min(6, Math.max(0, hits.max ?? 0));
    if (max <= 0) return null;
    const taken = Math.min(max, Math.max(0, hits.taken ?? 0));
    return Array.from({ length: max }, (_, i) => ({ index: i, checked: i < taken }));
  }

  /** One box per Stunt Point, filled from the left as points become available. */
  #prepareStuntBoxes() {
    const stuntPoints = this.actor.system.stuntPoints ?? {};
    const max = Math.min(STUNT_POINTS_MAX, Math.max(1, stuntPoints.max ?? 3));
    const value = Math.min(max, stuntPoints.value ?? 0);
    return Array.from({ length: max }, (_, i) => ({ index: i, checked: i < value }));
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

  /** The configured Stash track length (total boxes), clamped to a sane minimum. */
  get #stashTrackLength() {
    return Math.max(0, game.settings.get("foundryvtt-nco", "stashTrackLength") ?? 5);
  }

  /**
   * The Stash track split into groups of five boxes, so the template can draw a
   * horizontal divider between each group. Boxes fill from the left. Mirrors the
   * XP track, differing only in its (blue) fill color.
   */
  #prepareStashGroups() {
    const length = this.#stashTrackLength;
    const filled = Math.min(length, Math.max(0, this.actor.system.stash ?? 0));
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
   * @override Where a clicked track's filled-box count is stored and how high
   * it can go. The character has several tracks (Hits, Stunt Points, Stash, XP)
   * keyed by the clicked element's `data-track`; the click/right-click behavior
   * itself is shared (see NCOSheetMixin).
   */
  _trackConfig(track) {
    if (track === "hits") {
      return {
        field: "system.hits.taken",
        current: this.actor.system.hits?.taken ?? 0,
        max: Math.min(6, Math.max(1, this.actor.system.hits?.max ?? 3)),
      };
    }
    if (track === "stunt") {
      return {
        field: "system.stuntPoints.value",
        current: this.actor.system.stuntPoints?.value ?? 0,
        max: Math.min(STUNT_POINTS_MAX, Math.max(1, this.actor.system.stuntPoints?.max ?? 3)),
      };
    }
    if (track === "stash") {
      return {
        field: "system.stash",
        current: this.actor.system.stash ?? 0,
        max: this.#stashTrackLength,
      };
    }
    // Unique Gear damage track: `data-track` carries the item id ("gearHits:<id>")
    // so the update is routed to that embedded Item rather than the character.
    if (track?.startsWith("gearHits:")) {
      const item = this.actor.items.get(track.slice("gearHits:".length));
      if (!item) return null;
      return {
        document: item,
        field: "system.hits.taken",
        current: item.system.hits?.taken ?? 0,
        max: Math.min(6, Math.max(0, item.system.hits?.max ?? 0)),
      };
    }
    return {
      field: "system.xp",
      current: this.actor.system.xp ?? 0,
      max: this.#xpTrackLength,
    };
  }

  /**
   * Spend a Stunt Point: decrement the pool and post the list of ways the
   * point may be used to chat.
   */
  static async _onSpendStuntPoint(_event, _target) {
    if (!this.isEditable) return;
    const current = this.actor.system.stuntPoints?.value ?? 0;
    if (current <= 0) {
      ui.notifications.warn(game.i18n.format("NCO.Sheet.NoStuntPoints", { name: this.actor.name }));
      return;
    }
    const remaining = current - 1;
    await this.actor.update({ "system.stuntPoints.value": remaining });

    const options = ["Trademark", "Soak", "Adjust", "Detail"]
      .map((key) => `<li>${game.i18n.localize(`NCO.Chat.StuntPoint.Option${key}`)}</li>`)
      .join("");
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div style="border:1px solid var(--nco-action);border-radius:6px;padding:8px 10px;background:var(--nco-bg);">
          <div style="font-family:'Courier New',monospace;letter-spacing:1px;color:var(--nco-action);font-size:11px;text-transform:uppercase;">
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
    if (game.settings.get("foundryvtt-nco", "deathCheckEnabled")) {
      await this.#rollDeathCheck(name.trim());
    }
  }

  static async _onDeleteTrauma(_event, target) {
    const index = Number(target.dataset.traumaIndex);
    if (this.isEditable) await this.submit();
    const traumas = this.actor.toObject().system.traumas ?? [];
    if (index < 0 || index >= traumas.length) return;
    traumas.splice(index, 1);
    await this.actor.update({ "system.traumas": traumas });
  }

  /**
   * Add a new Advantage: prompt for a name and append it. Unlike a Trauma, an
   * Advantage is a positive Tag and adding one rolls no death check.
   */
  static async _onCreateAdvantage(_event, _target) {
    const placeholder = game.i18n.localize("NCO.Sheet.AdvantageNamePlaceholder");
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: "NCO.Sheet.AddAdvantageTitle" },
      content: `<input type="text" name="name" placeholder="${placeholder}" autofocus />`,
      rejectClose: false,
      ok: {
        icon: "fas fa-plus",
        label: "NCO.Sheet.AddAdvantage",
        callback: (_event, _button, dialog) =>
          dialog.element.querySelector('input[name="name"]')?.value ?? "",
      },
    });
    if (!name?.trim()) return;

    if (this.isEditable) await this.submit();
    const advantages = this.actor.toObject().system.advantages ?? [];
    advantages.push(name.trim());
    await this.actor.update({ "system.advantages": advantages });
  }

  static async _onDeleteAdvantage(_event, target) {
    const index = Number(target.dataset.advantageIndex);
    if (this.isEditable) await this.submit();
    const advantages = this.actor.toObject().system.advantages ?? [];
    if (index < 0 || index >= advantages.length) return;
    advantages.splice(index, 1);
    await this.actor.update({ "system.advantages": advantages });
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
    let outcomeColor = "var(--nco-action)";
    if (check.total === 1) {
      const turnsRoll = new Roll("1d6");
      await turnsRoll.evaluate();
      rolls.push(turnsRoll);
      outcome = game.i18n.format("NCO.Chat.DeathCheck.Dying", {
        name: escapeHTML(this.actor.name),
        turns: turnsRoll.total,
      });
      outcomeColor = "var(--nco-danger)";
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
        <div style="border:1px solid ${outcomeColor};border-radius:6px;padding:8px 10px;background:var(--nco-bg);">
          <div style="font-family:'Courier New',monospace;letter-spacing:1px;color:var(--nco-action);font-size:11px;text-transform:uppercase;">
            ${game.i18n.localize("NCO.Chat.DeathCheck.Title")}
          </div>
          <div style="margin:6px 0 2px;font-size:12px;">${suffered}</div>
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--nco-border);
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
