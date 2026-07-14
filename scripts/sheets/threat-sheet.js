import { NCOSheetMixin } from "./nco-sheet-mixin.js";
import { TAG_POLARITY } from "../tags.js";

const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Threat actor sheet for Neon City Overdrive NPCs.
 *
 * A Threat is a lightweight opponent: a Danger Rating, a configurable Hits
 * track, a freeform Drive and Actions note, and a list of Tags. Tag handling,
 * the play/edit toggle, the Danger Rating, and the Hits track all come from
 * {@link NCOSheetMixin}; only the Boss-aware Hits grouping is Threat-specific.
 *
 * Toggling Boss triples the Hits track; the track is then drawn with a divider
 * after every third box so it stays readable.
 */
export class ThreatSheet extends NCOSheetMixin(ActorSheetV2) {
  /** Hits are grouped (with dividers) by this many for Boss Threats. */
  static HIT_GROUP_SIZE = 3;

  /** A Threat's first Tag is most often a weakness, so new Tags default negative. */
  static NEW_TAG_POLARITY = TAG_POLARITY.NEGATIVE;

  /** @override A Threat renders no embedded Items, so accept none. */
  static ALLOWED_ITEM_TYPES = [];

  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "actor"],
    position: { width: 480, height: 560, top: 80 },
  };

  static PARTS = {
    // Preserve the body's scroll position across re-renders (submitOnChange
    // edits, track clicks, etc.).
    sheet: {
      template: "systems/foundryvtt-nco/templates/actor/threat-sheet.hbs",
      scrollable: [".nco-sheet-body"],
    },
  };

  /** @override Start a Tag-less Threat in edit mode so there's something to fill in. */
  _startsBlank() {
    return !(this.actor.system.tags ?? []).length;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const TextEditorImpl = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;

    return {
      ...context,
      ...this._baseContext(),
      hitGroups: this.#prepareHitGroups(),
      // The edit input must show (and write back) the pre-Boss source value:
      // the derived system.hits.max is tripled for Bosses, so binding to it
      // would bake the multiplier into the source on the next form submit.
      hitsMaxSource: this.actor._source.system.hits.max,
      tags: this._prepareTags(this.actor.system.tags),
      dangerRating: this.actor.system.dangerRating ?? 0,
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

  /** @override Single Boss-adjusted Hits track. */
  _trackConfig(_track) {
    const sys = this.actor.system;
    const max = sys.hits?.effectiveMax ?? Math.max(1, sys.hits?.max ?? 3);
    return { field: "system.hits.taken", current: sys.hits?.taken ?? 0, max };
  }
}
