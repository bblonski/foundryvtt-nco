import { NCOSheetMixin } from "./nco-sheet-mixin.js";

const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Scene sheet for Neon City Overdrive.
 *
 * A Scene is the situation or location the action takes place in — the simplest
 * tag-bearing element: just a Name and a list of Tags. It is an Item (not an
 * Actor) so Scenes can live in a Job's related list and in compendia without
 * cluttering the Actors directory. All behavior comes from {@link NCOSheetMixin}.
 */
export class SceneSheet extends NCOSheetMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "item"],
    position: { width: 480, height: 360, top: 80 },
  };

  static PARTS = {
    // Preserve the body's scroll position across re-renders.
    sheet: {
      template: "systems/foundryvtt-nco/templates/item/scene-sheet.hbs",
      scrollable: [".nco-sheet-body"],
    },
  };

  /** @override Start a Tag-less Scene in edit mode so there's something to fill in. */
  _startsBlank() {
    return !(this.document.system.tags ?? []).length;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      ...this._baseContext(),
      tags: this._prepareTags(this.document.system.tags),
    };
  }
}
