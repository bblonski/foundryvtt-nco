import { TAG_POLARITY } from "../tags.js";

/**
 * System data for the "gear" Item type (Unique Gear).
 *
 * Unique Gear is a named piece of equipment with its own list of Tags. Unlike
 * a Trademark, the Gear's name is not itself a Tag — only the Tags in its
 * list are, and each is independently positive (adds an Action die when
 * invoked) or negative (adds a Danger die).
 *
 * Unique Gear lives as an embedded Item on a character, so it can be authored
 * in the sidebar or a compendium and dragged onto a character sheet.
 */
export class GearData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      // Optional damage track (e.g. Armour with its own Hits). `max` is the
      // track length: it defaults to 0 (no track) and the track only renders on
      // the character sheet when `max > 0`. `taken` boxes fill as it is damaged.
      hits: new fields.SchemaField({
        taken: new fields.NumberField({ required: true, integer: true, min: 0, max: 6, initial: 0 }),
        max: new fields.NumberField({ required: true, integer: true, min: 0, max: 6, initial: 0 }),
      }),
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
}
