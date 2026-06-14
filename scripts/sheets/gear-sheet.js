import { Tags, TAG_POLARITY } from "../tags.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Sheet for the "gear" Item type (Unique Gear).
 *
 * Edits the Gear's name, description, and its list of Tags. Each Tag has its
 * own polarity, flipped independently of the others — positive Tags add an
 * Action die when invoked from a character sheet, negative Tags add a Danger
 * die. Form fields bind natively to the Item via submitOnChange; adding,
 * removing, and flipping Tags mutate the `system.tags` array directly.
 */
export class GearSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "item"],
    position: { width: 420, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: this._onEditImage,
      createTag: this._onCreateTag,
      deleteTag: this._onDeleteTag,
      toggleTagPolarity: this._onToggleTagPolarity,
    },
  };

  static PARTS = {
    sheet: { template: "systems/foundryvtt-nco/templates/item/gear-sheet.hbs" },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const TextEditorImpl = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;
    return {
      ...context,
      item: this.item,
      system: this.item.system,
      editable: this.isEditable,
      tags: (this.item.system.tags ?? []).map((tag) => ({
        text: tag.text,
        positive: tag.polarity !== TAG_POLARITY.NEGATIVE,
      })),
      descriptionHTML: await TextEditorImpl.enrichHTML(this.item.system.description ?? "", {
        relativeTo: this.item,
      }),
    };
  }

  /**
   * Flush any pending form edit, then return a plain copy of the tags array
   * for mutation, so an in-flight submitOnChange update can't clobber the
   * structural change (or vice versa).
   */
  async _tagsForUpdate() {
    if (this.isEditable) await this.submit();
    return this.item.toObject().system.tags ?? [];
  }

  static async _onCreateTag(_event, _target) {
    const tags = await this._tagsForUpdate();
    tags.push({ text: "", polarity: TAG_POLARITY.POSITIVE });
    await this.item.update({ "system.tags": tags });
  }

  static async _onDeleteTag(_event, target) {
    const index = Number(target.dataset.tagIndex);
    const tags = await this._tagsForUpdate();
    if (index < 0 || index >= tags.length) return;
    tags.splice(index, 1);
    await this.item.update({ "system.tags": tags });
  }

  /** Flip a Tag between positive and negative polarity. */
  static async _onToggleTagPolarity(_event, target) {
    const index = Number(target.dataset.tagIndex);
    const tags = await this._tagsForUpdate();
    if (index < 0 || index >= tags.length) return;
    tags[index].polarity = Tags.invert(tags[index].polarity ?? TAG_POLARITY.POSITIVE);
    await this.item.update({ "system.tags": tags });
  }

  /** Open a file picker for the Gear icon. */
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
