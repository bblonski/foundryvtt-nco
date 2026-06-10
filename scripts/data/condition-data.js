/**
 * System data for the "condition" Item type.
 *
 * A Condition is a tag-like affliction embedded on a character. Its name is
 * the Item's name; `active` marks whether it is currently affecting the
 * character. Active Conditions can be invoked from the sheet to add a Danger
 * die to the shared roll pool.
 */
export class ConditionData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      active: new fields.BooleanField({ required: true, initial: false }),
    };
  }
}
