import { Tags, TAG_POLARITY } from "../tags.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Scene actor sheet for Neon City Overdrive.
 *
 * A Scene is the simplest tag-bearing Actor: a Name and a list of Tags. It has
 * two modes per open sheet:
 *  - Edit mode: the name and Tags are form inputs, with controls to add and
 *    remove Tags and flip each Tag's polarity.
 *  - Play mode (default once the Scene has Tags): Tags render as clickable chips
 *    that add dice to the shared roll pool. A positive Tag adds an Action die, a
 *    negative Tag a Danger die; shift-click inverts a Tag.
 */
export class SceneSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "actor"],
    position: { width: 480, height: 360, top: 80 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: this._onEditImage,
      toggleEdit: this._onToggleEdit,
      invoke: this._onInvoke,
      createTag: this._onCreateTag,
      deleteTag: this._onDeleteTag,
      toggleTagPolarity: this._onToggleTagPolarity,
    },
  };

  static PARTS = {
    sheet: { template: "systems/foundryvtt-nco/templates/actor/scene-sheet.hbs" },
  };

  /** Show just the document name in the title bar, without the type prefix. */
  get title() {
    return this.document.name;
  }

  /**
   * Whether this sheet is currently in edit mode. Starts in edit mode for a
   * Scene with no Tags so there is something to fill in, otherwise in play mode
   * so the Tags are immediately clickable.
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
      tags: (this.actor.system.tags ?? []).map((tag) => ({
        text: tag.text,
        polarity: tag.polarity,
        positive: tag.polarity !== TAG_POLARITY.NEGATIVE,
        clickable: !!tag.text?.trim(),
      })),
      invokePositiveTitle: game.i18n.localize("NCO.Sheet.InvokePositive"),
      invokeNegativeTitle: game.i18n.localize("NCO.Sheet.InvokeNegative"),
    };
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
   * Flush any pending form edit, then return a plain copy of the tags array
   * for mutation, so an in-flight submitOnChange update can't clobber the
   * structural change (or vice versa).
   */
  async #tagsForUpdate() {
    if (this.isEditable) await this.submit();
    return this.actor.toObject().system.tags ?? [];
  }

  /** New Tags default to positive: a Scene's Tags are as likely to help as hinder. */
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

  /** Open a file picker for the Scene portrait. */
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
