import { GlobalRollPool } from "../global-roll-pool.js";
import { NCORollDialog } from "../applications/nco-roll-dialog.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);

/**
 * Character sheet for Neon City Overdrive characters.
 *
 * Has two modes per open sheet:
 *  - Edit mode: name, description, Trademarks and tags are form inputs, with
 *    controls to add/remove Trademarks and tags and mark tags as Edges.
 *  - Play mode (default once the character has content): Trademarks and tags
 *    render as labels. Clicking a Trademark or Edge sends it to the shared
 *    roll pool — as an Action die for players, as a Danger die for the GM
 *    (for whom every tag is clickable, not just Edges).
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
      deleteTrademark: this._onDeleteTrademark,
      createTag: this._onCreateTag,
      deleteTag: this._onDeleteTag,
      invoke: this._onInvoke,
      toggleHit: this._onToggleHit,
      spendStuntPoint: this._onSpendStuntPoint,
      toggleCondition: this._onToggleCondition,
      createCondition: this._onCreateCondition,
      deleteCondition: this._onDeleteCondition,
      createTrauma: this._onCreateTrauma,
      deleteTrauma: this._onDeleteTrauma,
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
    this._editing ??= !this.actor.system.trademarks?.length;
    return this._editing && this.isEditable;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isGM = game.user.isGM;
    const TextEditorImpl = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;

    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      editing: this.isEditing,
      editable: this.isEditable,
      isGM,
      // In play mode a tag is clickable if it is an Edge — or always, for the
      // GM, who invokes any tag as a Danger die.
      trademarks: (this.actor.system.trademarks ?? []).map((trademark) => ({
        name: trademark.name,
        clickable: !!trademark.name?.trim(),
        tags: (trademark.tags ?? []).map((tag) => ({
          text: tag.text,
          edge: tag.edge,
          clickable: !!tag.text?.trim() && (tag.edge || isGM),
        })),
      })),
      hitBoxes: this.#prepareHitBoxes(),
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
      invokeTitle: game.i18n.localize(isGM ? "NCO.Sheet.InvokeDanger" : "NCO.Sheet.InvokeAction"),
      invokeFlawTitle: game.i18n.localize("NCO.Sheet.InvokeDanger"),
      descriptionHTML: await TextEditorImpl.enrichHTML(this.actor.system.description ?? "", {
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

  /**
   * Toggle a hit box with fill-track behavior: checking box N also checks
   * every box before it, unchecking it also clears every box after it.
   */
  static async _onToggleHit(_event, target) {
    if (!this.isEditable) return;
    const index = Number(target.dataset.index);
    const taken = this.actor.system.hits?.taken ?? 0;
    const newTaken = index < taken ? index : index + 1;
    await this.actor.update({ "system.hits.taken": newTaken });
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
   * Click a Trademark, tag, or Flaw label: add it to the shared roll pool and
   * show the roll window. The chip may force a die type (Flaws are always
   * Danger); otherwise players add Action dice and the GM adds Danger dice.
   */
  static async _onInvoke(_event, target) {
    const type = target.dataset.dieType ?? (game.user.isGM ? "danger" : "action");
    await GlobalRollPool.add(type, target.dataset.text, this.actor.name);
    NCORollDialog.open();
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

  /**
   * Flush any pending form edits, then return a plain copy of the trademarks
   * array for mutation. Submitting first prevents an in-flight submitOnChange
   * update from clobbering the structural change (or vice versa).
   */
  async _trademarksForUpdate() {
    if (this.isEditable) await this.submit();
    return this.actor.toObject().system.trademarks ?? [];
  }

  static async _onCreateTrademark(_event, _target) {
    const trademarks = await this._trademarksForUpdate();
    trademarks.push({ name: "", tags: [] });
    this._editing = true;
    await this.actor.update({ "system.trademarks": trademarks });
  }

  static async _onDeleteTrademark(_event, target) {
    const index = Number(target.dataset.trademarkIndex);
    const trademarks = await this._trademarksForUpdate();
    const trademark = trademarks[index];
    if (!trademark) return;

    // Only prompt when the Trademark actually has content to lose.
    if (trademark.name?.trim() || trademark.tags?.length) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: "NCO.Sheet.DeleteTrademark" },
        content: `<p>${game.i18n.localize("NCO.Sheet.DeleteTrademarkConfirm")}</p>`,
      });
      if (!confirmed) return;
    }

    trademarks.splice(index, 1);
    await this.actor.update({ "system.trademarks": trademarks });
  }

  static async _onCreateTag(_event, target) {
    const index = Number(target.dataset.trademarkIndex);
    const trademarks = await this._trademarksForUpdate();
    if (!trademarks[index]) return;
    trademarks[index].tags.push({ text: "", edge: false });
    await this.actor.update({ "system.trademarks": trademarks });
  }

  static async _onDeleteTag(_event, target) {
    const trademarkIndex = Number(target.dataset.trademarkIndex);
    const tagIndex = Number(target.dataset.tagIndex);
    const trademarks = await this._trademarksForUpdate();
    if (!trademarks[trademarkIndex]) return;
    trademarks[trademarkIndex].tags.splice(tagIndex, 1);
    await this.actor.update({ "system.trademarks": trademarks });
  }
}
