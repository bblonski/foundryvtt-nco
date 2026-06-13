/**
 * System data for the "trademark" Item type.
 *
 * A Trademark is a named cluster of Triggers; the Item's name is the Trademark
 * name (always a positive Tag in play). Each Trigger is not a Tag — it adds no
 * dice — until it is checked as an "edge", at which point it becomes a positive
 * Tag that can be clicked to add an Action die.
 *
 * Trademarks live as embedded Items on a character, so they can be authored in
 * the sidebar or a compendium and dragged onto a character sheet.
 */
export class TrademarkData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      triggers: new fields.ArrayField(
        new fields.SchemaField({
          text: new fields.StringField({ required: true, blank: true, initial: "" }),
          // An edged Trigger is a positive Tag and adds an Action die.
          edge: new fields.BooleanField({ required: true, initial: false }),
        }),
      ),
    };
  }
}
