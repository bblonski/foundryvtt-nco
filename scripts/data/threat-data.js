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
 * A Boss is a tougher Threat whose Hits are tripled; the sheet draws a divider
 * after every third box so the (now longer) track stays readable.
 */
export class ThreatData extends foundry.abstract.TypeDataModel {
  /** Boss Threats have this many times the Hits of a normal Threat. */
  static BOSS_HITS_MULTIPLIER = 3;

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      // A special negative Tag: invoking it adds this many Danger dice.
      dangerRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      // Boss Threats triple their Hits (see prepareDerivedData).
      boss: new fields.BooleanField({ required: true, initial: false }),
      // Hits are a damage track: `taken` boxes are checked off as the Threat is
      // hurt, out of a per-Threat `max`. Bosses triple the effective maximum.
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
    const multiplier = this.boss ? ThreatData.BOSS_HITS_MULTIPLIER : 1;
    // The effective Hits ceiling once the Boss multiplier is applied.
    this.hits.effectiveMax = Math.max(1, this.hits.max) * multiplier;
    // Remaining hits, primarily for token resource bars.
    this.hits.value = Math.max(0, this.hits.effectiveMax - this.hits.taken);
  }
}
