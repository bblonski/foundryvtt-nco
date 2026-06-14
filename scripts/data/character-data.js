/**
 * System data for the "character" Actor type.
 *
 * A character has a description, a damage track, and tag-bearing elements.
 * Trademarks are embedded Items (see {@link TrademarkData}), so they are not
 * part of this schema.
 */
export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      // Hits are a damage track: `taken` boxes are checked off as the
      // character is hurt, out of a per-character `max` that starts at the
      // world's starting-hits setting and may grow with advancement (the
      // world's max-hits setting caps it in the sheet UI; 6 is the absolute
      // ceiling the system supports).
      hits: new fields.SchemaField({
        taken: new fields.NumberField({ required: true, integer: true, min: 0, max: 6, initial: 0 }),
        max: new fields.NumberField({
          required: true,
          integer: true,
          min: 1,
          max: 6,
          initial: () => {
            try {
              return game.settings.get("foundryvtt-nco", "startingHits");
            } catch (e) {
              return 3;
            }
          },
        }),
      }),
      // Every character has exactly two Flaw slots; invoking a Flaw always
      // adds a Danger die to the shared roll pool.
      flaws: new fields.ArrayField(
        new fields.StringField({ required: true, blank: true, initial: "" }),
        { initial: ["", ""] },
      ),
      // Lasting injuries. Like Flaws they are invoked as Danger dice, but the
      // list is open-ended: suffering a new Trauma triggers a death check.
      traumas: new fields.ArrayField(
        new fields.StringField({ required: true, blank: true, initial: "" }),
      ),
      // Meta-currency spent for stunts; clicking the sheet label spends one
      // and posts the spending options to chat. NCO characters start with 3.
      stuntPoints: new fields.NumberField({ required: true, integer: true, min: 0, initial: 3 }),
      // Simple Gear: a freeform notes box for everyday equipment that doesn't
      // warrant its own Tags. Unique Gear (see GearData) is embedded Items with
      // their own positive and negative Tags, for items significant enough to
      // warrant that detail.
      gear: new fields.HTMLField({ required: false, blank: true, initial: "" }),
    };
  }

  /** @override */
  prepareDerivedData() {
    // Remaining hits, primarily for token resource bars.
    this.hits.value = Math.max(0, this.hits.max - this.hits.taken);
  }
}
