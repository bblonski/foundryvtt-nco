import { Tags, TAG_POLARITY } from "../tags.js";
import { VehicleData } from "../data/vehicle-data.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Vehicle actor sheet for Neon City Overdrive.
 *
 * A Vehicle is similar to a Threat: a Danger Rating, a Hits track, and a list
 * of Tags. It has no Boss toggle or Drive/Actions text, and Conditions/
 * Criticals are freeform entries edited inline, the same as a Character's
 * Traumas. It has two modes per open sheet:
 *  - Edit mode: name, Hits maximum, Danger Rating, Tags, and Conditions/
 *    Criticals are form inputs, with controls to add and remove Tags and
 *    Conditions/Criticals.
 *  - Play mode (default once the Vehicle has Tags): Tags and the Danger
 *    Rating render as clickable chips that add dice to the shared roll pool.
 *    A positive Tag adds an Action die, a negative Tag a Danger die; the
 *    Danger Rating adds its rating's worth of Danger dice. Shift-click
 *    inverts a Tag.
 */
export class VehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "actor"],
    position: { width: 480, height: 480, top: 80 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: this._onEditImage,
      toggleEdit: this._onToggleEdit,
      trackAdd: this._onTrackAdd,
      invoke: this._onInvoke,
      invokeDanger: this._onInvokeDanger,
      createTag: this._onCreateTag,
      deleteTag: this._onDeleteTag,
      toggleTagPolarity: this._onToggleTagPolarity,
      createCritical: this._onCreateCritical,
      deleteCritical: this._onDeleteCritical,
    },
  };

  static PARTS = {
    sheet: { template: "systems/foundryvtt-nco/templates/actor/vehicle-sheet.hbs" },
  };

  /**
   * Whether this sheet is currently in edit mode. Starts in edit mode for a
   * Vehicle with no Tags so there is something to fill in, otherwise in play
   * mode so the Tags are immediately clickable.
   * @type {boolean|undefined}
   */
  _editing;

  get isEditing() {
    this._editing ??= !(this.actor.system.tags ?? []).length;
    return this._editing && this.isEditable;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      editing: this.isEditing,
      editable: this.isEditable,
      maxHits: VehicleData.MAX_HITS,
      hitBoxes: this.#prepareHitBoxes(),
      tags: (this.actor.system.tags ?? []).map((tag) => ({
        text: tag.text,
        polarity: tag.polarity,
        positive: tag.polarity !== TAG_POLARITY.NEGATIVE,
        clickable: !!tag.text?.trim(),
      })),
      criticals: (this.actor.system.criticals ?? []).map((text) => ({
        text,
        clickable: !!text?.trim(),
      })),
      trackHint: game.i18n.localize(
        game.settings.get("foundryvtt-nco", "trackClickMode") === "fill"
          ? "NCO.Sheet.TrackHintFill"
          : "NCO.Sheet.TrackHintIncrement",
      ),
      dangerRating: this.actor.system.dangerRating ?? 0,
      invokePositiveTitle: game.i18n.localize("NCO.Sheet.InvokePositive"),
      invokeNegativeTitle: game.i18n.localize("NCO.Sheet.InvokeNegative"),
      invokeDangerTitle: game.i18n.localize("NCO.Sheet.InvokeDangerRating"),
    };
  }

  /** One checkbox per hit, checked from the left as damage is taken. */
  #prepareHitBoxes() {
    const hits = this.actor.system.hits ?? {};
    const max = Math.min(VehicleData.MAX_HITS, Math.max(1, hits.max ?? 3));
    const taken = Math.min(max, Math.max(0, hits.taken ?? 0));
    return Array.from({ length: max }, (_, i) => ({ index: i, checked: i < taken }));
  }

  /** Where the Hits track is stored and how high it can go. */
  #trackConfig() {
    const sys = this.actor.system;
    const max = Math.min(VehicleData.MAX_HITS, Math.max(1, sys.hits?.max ?? 3));
    return { field: "system.hits.taken", current: sys.hits?.taken ?? 0, max };
  }

  /**
   * Left-click the Hits track. The world's "track click mode" setting decides
   * whether this adds a single box ("increment") or fills/clears up to the
   * clicked box ("fill"). Shared behavior with the character and threat sheets.
   */
  static async _onTrackAdd(event, _target) {
    if (!this.isEditable) return;
    const cfg = this.#trackConfig();
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

  /** Right-click the Hits track: clear the last box (only in "increment" mode). */
  async #onTrackRemove(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    if (game.settings.get("foundryvtt-nco", "trackClickMode") !== "increment") return;
    const cfg = this.#trackConfig();
    const next = Math.max(0, cfg.current - 1);
    if (next !== cfg.current) await this.actor.update({ [cfg.field]: next });
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    // Right-click isn't an ActionV2 trigger, so wire the track's contextmenu
    // (decrement) manually. The element is rebuilt each render, so re-bind here.
    for (const el of this.element.querySelectorAll(".nco-track")) {
      el.addEventListener("contextmenu", this.#onTrackRemove.bind(this));
    }
  }

  /**
   * Click a Tag: add it to the shared roll pool. Positive Tags add an Action
   * die, negative Tags a Danger die; shift-click inverts the polarity.
   */
  static async _onInvoke(event, target) {
    await Tags.invoke({
      text: target.dataset.text,
      polarity: target.dataset.polarity ?? TAG_POLARITY.POSITIVE,
      source: this.actor.name,
      invert: event.shiftKey,
    });
  }

  /**
   * Click the Danger Rating: add that many Danger dice to the shared roll pool.
   * Shift-click adds them as Action dice instead.
   */
  static async _onInvokeDanger(event, _target) {
    const rating = this.actor.system.dangerRating ?? 0;
    if (rating <= 0) return;
    await Tags.invoke({
      text: game.i18n.localize("NCO.Sheet.DangerRating"),
      polarity: TAG_POLARITY.NEGATIVE,
      source: this.actor.name,
      invert: event.shiftKey,
      count: rating,
    });
  }

  /**
   * Flush any pending form edit, then return a plain copy of the tags array
   * for mutation, so an in-flight submitOnChange update can't clobber the
   * structural change (or vice versa).
   */
  async #tagsForUpdate() {
    if (this.isEditable) await this.submit();
    return this.actor.toObject().system.tags ?? [];
  }

  /** New Tags default to positive: a Vehicle is as likely to be a PC asset as an opponent's. */
  static async _onCreateTag(_event, _target) {
    this._editing = true;
    const tags = await this.#tagsForUpdate();
    tags.push({ text: "", polarity: TAG_POLARITY.POSITIVE });
    await this.actor.update({ "system.tags": tags });
  }

  static async _onDeleteTag(_event, target) {
    const index = Number(target.dataset.tagIndex);
    const tags = await this.#tagsForUpdate();
    if (index < 0 || index >= tags.length) return;
    tags.splice(index, 1);
    await this.actor.update({ "system.tags": tags });
  }

  /** Flip a Tag between positive and negative polarity. */
  static async _onToggleTagPolarity(_event, target) {
    const index = Number(target.dataset.tagIndex);
    const tags = await this.#tagsForUpdate();
    if (index < 0 || index >= tags.length) return;
    tags[index].polarity = Tags.invert(tags[index].polarity ?? TAG_POLARITY.POSITIVE);
    await this.actor.update({ "system.tags": tags });
  }

  /**
   * Flush any pending form edit, then return a plain copy of the criticals
   * array for mutation, so an in-flight submitOnChange update can't clobber
   * the structural change (or vice versa).
   */
  async #criticalsForUpdate() {
    if (this.isEditable) await this.submit();
    return this.actor.toObject().system.criticals ?? [];
  }

  /** Prompt for a name and add a new Condition/Critical to the Vehicle. */
  static async _onCreateCritical(_event, _target) {
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
    const criticals = await this.#criticalsForUpdate();
    criticals.push(name.trim());
    await this.actor.update({ "system.criticals": criticals });
  }

  static async _onDeleteCritical(_event, target) {
    const index = Number(target.dataset.criticalIndex);
    const criticals = await this.#criticalsForUpdate();
    if (index < 0 || index >= criticals.length) return;
    criticals.splice(index, 1);
    await this.actor.update({ "system.criticals": criticals });
  }

  static _onToggleEdit(_event, _target) {
    this._editing = !this.isEditing;
    this.render();
  }

  /** Open a file picker for the Vehicle portrait. */
  static async _onEditImage(_event, _target) {
    const FilePickerImpl = foundry.applications.apps?.FilePicker?.implementation ?? FilePicker;
    const picker = new FilePickerImpl({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path }),
    });
    return picker.browse();
  }
}
