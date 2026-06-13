import { GlobalRollPool } from "./global-roll-pool.js";
import { NCORollDialog } from "./applications/nco-roll-dialog.js";

/**
 * Shared Tag handling for every tag-bearing game element (characters today;
 * gear and opponents later). Centralized so every element invokes Tags the
 * same way.
 *
 * A Tag is anything that adds dice to a roll:
 *  - A *positive* Tag (a Trademark name or an Edge) adds an Action die.
 *  - A *negative* Tag (a Flaw, Trauma, or Condition) adds a Danger die.
 *
 * Triggers are the components of a Trademark and are NOT Tags until upgraded
 * to an Edge, so they never add dice — only Edges do.
 *
 * Polarity is intrinsic to the Tag and identical for GMs and players. Shift-
 * clicking inverts it (a positive Tag becomes a Danger die and vice versa).
 */
export const TAG_POLARITY = Object.freeze({ POSITIVE: "positive", NEGATIVE: "negative" });

export class Tags {
  /** The shared roll-pool die type a polarity contributes. */
  static dieType(polarity) {
    return polarity === TAG_POLARITY.NEGATIVE ? "danger" : "action";
  }

  /** The opposite polarity, used for shift-click inversion. */
  static invert(polarity) {
    return polarity === TAG_POLARITY.NEGATIVE ? TAG_POLARITY.POSITIVE : TAG_POLARITY.NEGATIVE;
  }

  /**
   * Add a Tag to the shared roll pool and surface the roll dialog.
   * @param {object}  options
   * @param {string}  options.text       The Tag text.
   * @param {string}  [options.polarity] A TAG_POLARITY value (positive by default).
   * @param {string}  [options.source]   Name of the element it came from.
   * @param {boolean} [options.invert]   Flip polarity (shift-click).
   */
  static async invoke({ text, polarity = TAG_POLARITY.POSITIVE, source = "", invert = false } = {}) {
    if (!text?.trim()) return;
    const effective = invert ? this.invert(polarity) : polarity;
    await GlobalRollPool.add(this.dieType(effective), text, source);
    NCORollDialog.open();
  }
}
