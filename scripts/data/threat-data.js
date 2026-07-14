import { TAG_POLARITY } from "../tags.js";

/**
 * System data for the "threat" Actor type (NPCs).
 *
 * A Threat is a lightweight opponent: a Danger Rating, a configurable Hits
 * track, a freeform Drive and Actions note, and a list of Tags. Unlike a
 * character, its Drive is plain text rather than a track.
 *
 * The Danger Rating is a special negative Tag expressed as a single integer:
 * invoking it adds that many Danger dice to the shared roll pool.
 *
 * A Boss is a tougher Threat with an extended Hits track; the sheet draws a
 * divider after every third box so the (now longer) track stays readable. How
 * the track extends is a world setting (`bossHitsMode`): NCO triples the Hits,
 * Star Scoundrels instead adds one Hit per player character (`pcCount`).
 */
export class ThreatData extends foundry.abstract.TypeDataModel {
  /** Boss Threats have this many times the Hits of a normal Threat. */
  static BOSS_HITS_MULTIPLIER = 3;

  /**
   * The Boss-adjusted Hits ceiling for a base max, per the `bossHitsMode`
   * world setting: multiply the base Hits, or add one Hit per PC.
   */
  static bossHitsMax(base) {
    let mode = "multiply";
    let pcs = 0;
    try {
      mode = game.settings.get("foundryvtt-nco", "bossHitsMode");
      pcs = game.settings.get("foundryvtt-nco", "pcCount");
    } catch {
      // Settings not registered yet (very early data prep) — use the default.
    }
    return mode === "addPCs" ? base + Math.max(0, pcs) : base * ThreatData.BOSS_HITS_MULTIPLIER;
  }

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      // A special negative Tag: invoking it adds this many Danger dice.
      dangerRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      // Boss Threats extend their Hits (see prepareDerivedData).
      boss: new fields.BooleanField({ required: true, initial: false }),
      // Hits are a damage track: `taken` boxes are checked off as the Threat is
      // hurt, out of a per-Threat `max`. Bosses extend the effective maximum.
      hits: new fields.SchemaField({
        taken: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        max: new fields.NumberField({ required: true, integer: true, min: 1, initial: 3 }),
      }),
      // Drive: plain freeform text describing what the Threat wants. Not a track.
      drive: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      // Actions: freeform text listing what the Threat can do.
      actions: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      // Tags: each is independently positive (Action die) or negative (Danger
      // die) when invoked, like Unique Gear Tags.
      tags: new fields.ArrayField(
        new fields.SchemaField({
          text: new fields.StringField({ required: true, blank: true, initial: "" }),
          polarity: new fields.StringField({
            required: true,
            initial: TAG_POLARITY.POSITIVE,
            choices: [TAG_POLARITY.POSITIVE, TAG_POLARITY.NEGATIVE],
          }),
        }),
      ),
    };
  }

  /** @override */
  prepareDerivedData() {
    const base = Math.max(1, this.hits.max);
    // The effective Hits ceiling once the Boss adjustment is applied.
    this.hits.effectiveMax = this.boss ? ThreatData.bossHitsMax(base) : base;
    // Token resource bars read hits.value/hits.max directly, so the derived
    // max must be the Boss-adjusted ceiling (the sheet's edit input binds to
    // the *source* max instead — see ThreatSheet). Clamp taken so toggling
    // Boss off can't leave a stale overflow behind.
    this.hits.max = this.hits.effectiveMax;
    this.hits.taken = Math.min(this.hits.taken, this.hits.effectiveMax);
    // Remaining hits, primarily for token resource bars.
    this.hits.value = Math.max(0, this.hits.effectiveMax - this.hits.taken);
  }
}
