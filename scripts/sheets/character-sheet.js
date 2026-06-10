import { GlobalRollPool } from "../global-roll-pool.js";
import { NCORollDialog } from "../applications/nco-roll-dialog.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

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
      invokeTitle: game.i18n.localize(isGM ? "NCO.Sheet.InvokeDanger" : "NCO.Sheet.InvokeAction"),
      descriptionHTML: await TextEditorImpl.enrichHTML(this.actor.system.description ?? "", {
        relativeTo: this.actor,
      }),
    };
  }

  /** Click a Trademark or tag label: add it to the shared roll pool and show the roll window. */
  static async _onInvoke(_event, target) {
    const type = game.user.isGM ? "danger" : "action";
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
