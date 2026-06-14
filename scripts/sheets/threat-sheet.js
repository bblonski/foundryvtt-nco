import { Tags, TAG_POLARITY } from "../tags.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Threat actor sheet for Neon City Overdrive NPCs.
 *
 * A Threat is a lightweight opponent: a Danger Rating, a configurable Hits
 * track, a freeform Drive and Actions note, and a list of Tags. It has two
 * modes per open sheet:
 *  - Edit mode: name, Hits maximum, Danger Rating, Drive, Actions, and Tags
 *    are form inputs, with controls to add and remove Tags.
 *  - Play mode (default once the Threat has Tags): Tags and the Danger Rating
 *    render as clickable chips that add dice to the shared roll pool. A
 *    positive Tag adds an Action die, a negative Tag a Danger die; the Danger
 *    Rating adds its rating's worth of Danger dice. Shift-click inverts a Tag.
 *
 * Toggling Boss triples the Hits track; the track is then drawn with a divider
 * after every third box so it stays readable.
 */
export class ThreatSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** Hits are grouped (with dividers) by this many for Boss Threats. */
  static HIT_GROUP_SIZE = 3;

  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "actor"],
    position: { width: 480, height: 560 },
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
    },
  };

  static PARTS = {
    sheet: { template: "systems/foundryvtt-nco/templates/actor/threat-sheet.hbs" },
  };

  /**
   * Whether this sheet is currently in edit mode. Starts in edit mode for a
   * Threat with no Tags so there is something to fill in, otherwise in play
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
    const TextEditorImpl = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;

    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      editing: this.isEditing,
      editable: this.isEditable,
      hitGroups: this.#prepareHitGroups(),
      tags: (this.actor.system.tags ?? []).map((tag) => ({
        text: tag.text,
        polarity: tag.polarity,
        positive: tag.polarity !== TAG_POLARITY.NEGATIVE,
        clickable: !!tag.text?.trim(),
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
      driveHTML: await TextEditorImpl.enrichHTML(this.actor.system.drive ?? "", {
        relativeTo: this.actor,
      }),
      actionsHTML: await TextEditorImpl.enrichHTML(this.actor.system.actions ?? "", {
        relativeTo: this.actor,
      }),
    };
  }

  /**
   * The Hits track split into groups for the template. Bosses triple their
   * Hits and are grouped in threes (so a divider can be drawn between each
   * group); a normal Threat is a single ungrouped row. Boxes fill from the left.
   */
  #prepareHitGroups() {
    const sys = this.actor.system;
    const max = sys.hits?.effectiveMax ?? Math.max(1, sys.hits?.max ?? 3);
    const taken = Math.min(max, Math.max(0, sys.hits?.taken ?? 0));
    const groupSize = sys.boss ? ThreatSheet.HIT_GROUP_SIZE : max;
    const groups = [];
    for (let i = 0; i < max; i += groupSize) {
      groups.push(
        Array.from({ length: Math.min(groupSize, max - i) }, (_, j) => ({
          index: i + j,
          checked: i + j < taken,
        })),
      );
    }
    return groups;
  }

  /** Where the Hits track is stored and how high it can go (Boss-adjusted). */
  #trackConfig() {
    const sys = this.actor.system;
    const max = sys.hits?.effectiveMax ?? Math.max(1, sys.hits?.max ?? 3);
    return { field: "system.hits.taken", current: sys.hits?.taken ?? 0, max };
  }

  /**
   * Left-click the Hits track. The world's "track click mode" setting decides
   * whether this adds a single box ("increment") or fills/clears up to the
   * clicked box ("fill"). Shared behavior with the character sheet's tracks.
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

  static _onToggleEdit(_event, _target) {
    this._editing = !this.isEditing;
    this.render();
  }

  /** Open a file picker for the Threat portrait. */
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
