/**
 * System data for the "character" Actor type.
 *
 * A character has a description and a set of Trademarks. Each Trademark is a
 * named cluster of Triggers. A Trigger is not a Tag — it adds no dice — until
 * it is checked as an "edge", at which point it becomes a positive Tag that
 * can be clicked in the global roll dialog to add an Action die.
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
      trademarks: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, blank: true, initial: "" }),
          triggers: new fields.ArrayField(
            new fields.SchemaField({
              text: new fields.StringField({ required: true, blank: true, initial: "" }),
              // An edged Trigger is a positive Tag and adds an Action die.
              edge: new fields.BooleanField({ required: true, initial: false }),
            }),
          ),
        }),
      ),
    };
  }

  /** @override */
  prepareDerivedData() {
    // Remaining hits, primarily for token resource bars.
    this.hits.value = Math.max(0, this.hits.max - this.hits.taken);
  }
}
