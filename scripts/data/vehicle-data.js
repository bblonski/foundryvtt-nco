import { TAG_POLARITY } from "../tags.js";

/**
 * System data for the "vehicle" Actor type.
 *
 * A Vehicle is similar to a Threat: a Danger Rating, a Hits track, and a list
 * of Tags. Unlike a Threat it has no Boss toggle or Drive/Actions text, and
 * its Hits track is capped at a fixed maximum.
 *
 * New Tags on a Vehicle default to positive polarity (an Action die when
 * invoked), since a Vehicle is as likely to be a PC-owned asset as an
 * opponent's.
 *
 * Conditions/Criticals are freeform text entries, edited inline like a
 * Character's Traumas; each is always invoked as a Danger die.
 */
export class VehicleData extends foundry.abstract.TypeDataModel {
  /** Absolute ceiling for the Hits track. */
  static MAX_HITS = 10;

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      // A special negative Tag: invoking it adds this many Danger dice.
      dangerRating: new fields.NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      // Hits are a damage track: `taken` boxes are checked off as the Vehicle
      // is damaged, out of a per-Vehicle `max`.
      hits: new fields.SchemaField({
        taken: new fields.NumberField({
          required: true,
          integer: true,
          min: 0,
          max: VehicleData.MAX_HITS,
          initial: 0,
        }),
        max: new fields.NumberField({
          required: true,
          integer: true,
          min: 1,
          max: VehicleData.MAX_HITS,
          initial: 3,
        }),
      }),
      // Tags: each is independently positive (Action die) or negative (Danger
      // die) when invoked, like Unique Gear and Threat Tags.
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
      // Conditions/Criticals: freeform text, edited inline like Traumas. Always
      // invoked as a Danger die. Starts empty.
      criticals: new fields.ArrayField(
        new fields.StringField({ required: true, blank: true, initial: "" }),
      ),
    };
  }

  /** @override */
  prepareDerivedData() {
    // Remaining hits, primarily for token resource bars.
    this.hits.value = Math.max(0, this.hits.max - this.hits.taken);
  }
}
