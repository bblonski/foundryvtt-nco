import { NCOSheetMixin } from "./nco-sheet-mixin.js";
import { VehicleData } from "../data/vehicle-data.js";

const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Vehicle actor sheet for Neon City Overdrive.
 *
 * A Vehicle is similar to a Threat: a Danger Rating, a Hits track, and a list
 * of Tags — all handled by {@link NCOSheetMixin}. Unlike a Threat it has no
 * Boss toggle or Drive/Actions text, its Hits track is capped at a fixed
 * maximum, and its Conditions/Criticals are freeform text entries edited inline
 * (like a Character's Traumas), each always invoked as a Danger die.
 */
export class VehicleSheet extends NCOSheetMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "actor"],
    position: { width: 480, height: 480, top: 80 },
    actions: {
      createCritical: this._onCreateCritical,
      deleteCritical: this._onDeleteCritical,
    },
  };

  static PARTS = {
    // Preserve the body's scroll position across re-renders (submitOnChange
    // edits, track clicks, etc.).
    sheet: {
      template: "systems/foundryvtt-nco/templates/actor/vehicle-sheet.hbs",
      scrollable: [".nco-sheet-body"],
    },
  };

  /** @override Start a Tag-less Vehicle in edit mode so there's something to fill in. */
  _startsBlank() {
    return !(this.actor.system.tags ?? []).length;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    return {
      ...context,
      ...this._baseContext(),
      maxHits: VehicleData.MAX_HITS,
      hitBoxes: this.#prepareHitBoxes(),
      tags: this._prepareTags(this.actor.system.tags),
      criticals: (this.actor.system.criticals ?? []).map((text) => ({
        text,
        clickable: !!text?.trim(),
      })),
      dangerRating: this.actor.system.dangerRating ?? 0,
    };
  }

  /** One checkbox per hit, checked from the left as damage is taken. */
  #prepareHitBoxes() {
    const hits = this.actor.system.hits ?? {};
    const max = Math.min(VehicleData.MAX_HITS, Math.max(1, hits.max ?? 3));
    const taken = Math.min(max, Math.max(0, hits.taken ?? 0));
    return Array.from({ length: max }, (_, i) => ({ index: i, checked: i < taken }));
  }

  /** @override Single Hits track, capped at the Vehicle maximum. */
  _trackConfig(_track) {
    const sys = this.actor.system;
    const max = Math.min(VehicleData.MAX_HITS, Math.max(1, sys.hits?.max ?? 3));
    return { field: "system.hits.taken", current: sys.hits?.taken ?? 0, max };
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
}
