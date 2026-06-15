const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Sheet for the "trademark" Item type.
 *
 * Edits the Trademark's name and its list of Triggers, each of which can be
 * marked as an Edge. Form fields bind natively to the Item via submitOnChange;
 * adding and removing Triggers mutate the `system.triggers` array directly.
 */
export class TrademarkSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "item"],
    position: { width: 420, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: this._onEditImage,
      createTrigger: this._onCreateTrigger,
      deleteTrigger: this._onDeleteTrigger,
    },
  };

  static PARTS = {
    sheet: { template: "systems/foundryvtt-nco/templates/item/trademark-sheet.hbs" },
  };

  /** Show just the document name in the title bar, without the type prefix. */
  get title() {
    return this.document.name;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      item: this.item,
      system: this.item.system,
      editable: this.isEditable,
      triggers: this.item.system.triggers ?? [],
    };
  }

  /**
   * Flush any pending form edit, then return a plain copy of the triggers array
   * for mutation, so an in-flight submitOnChange update can't clobber the
   * structural change (or vice versa).
   */
  async _triggersForUpdate() {
    if (this.isEditable) await this.submit();
    return this.item.toObject().system.triggers ?? [];
  }

  static async _onCreateTrigger(_event, _target) {
    const triggers = await this._triggersForUpdate();
    triggers.push({ text: "", edge: false });
    await this.item.update({ "system.triggers": triggers });
  }

  static async _onDeleteTrigger(_event, target) {
    const index = Number(target.dataset.triggerIndex);
    const triggers = await this._triggersForUpdate();
    if (index < 0 || index >= triggers.length) return;
    triggers.splice(index, 1);
    await this.item.update({ "system.triggers": triggers });
  }

  /** Open a file picker for the Trademark icon. */
  static async _onEditImage(_event, _target) {
    const FilePickerImpl = foundry.applications.apps?.FilePicker?.implementation ?? FilePicker;
    const picker = new FilePickerImpl({
      type: "image",
      current: this.item.img,
      callback: (path) => this.item.update({ img: path }),
    });
    return picker.browse();
  }
}
