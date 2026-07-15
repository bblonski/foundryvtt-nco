const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Sheet for the "condition" Item type.
 *
 * A Condition is a simple tag-like affliction: its name is the Item's name and
 * `active` marks whether it is currently affecting the character. Conditions
 * are normally managed inline on the actor sheet; this minimal sheet lets the
 * name and active state be edited directly when the Item is opened.
 */
export class ConditionSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "item"],
    position: { width: 360, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: this._onEditImage,
    },
  };

  static PARTS = {
    // Preserve the body's scroll position across re-renders.
    sheet: {
      template: "systems/foundryvtt-nco/templates/item/condition-sheet.hbs",
      scrollable: [".nco-sheet-body"],
    },
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
      // With the condition/trauma-tracks setting on, `active` is derived from
      // the hit track (see ConditionData), so the checkbox is display-only.
      activeLocked: game.settings.get("foundryvtt-nco", "conditionTraumaTracksEnabled"),
    };
  }

  /** Open a file picker for the Condition icon. */
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
