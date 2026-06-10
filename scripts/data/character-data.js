/**
 * System data for the "character" Actor type.
 *
 * A character has a description and a set of Trademarks. Each Trademark is a
 * named cluster of narrative tags; a tag checked as an "edge" can be clicked
 * in the global roll dialog to add it as an action or danger die.
 */
export class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      description: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      // Every character has exactly two Flaw slots; invoking a Flaw always
      // adds a Danger die to the shared roll pool.
      flaws: new fields.ArrayField(
        new fields.StringField({ required: true, blank: true, initial: "" }),
        { initial: ["", ""] },
      ),
      trademarks: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, blank: true, initial: "" }),
          tags: new fields.ArrayField(
            new fields.SchemaField({
              text: new fields.StringField({ required: true, blank: true, initial: "" }),
              edge: new fields.BooleanField({ required: true, initial: false }),
            }),
          ),
        }),
      ),
    };
  }
}
