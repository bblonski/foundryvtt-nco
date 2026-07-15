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
      // Filled boxes on the Condition's optional three-box hit track, shown on
      // the character sheet when the world's condition/trauma-tracks setting
      // is enabled (e.g. Tomorrow City).
      hits: new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
    };
  }

  /**
   * @override When the condition/trauma-tracks setting is on, the hit track
   * replaces the on/off toggle: the Condition counts as active while it has
   * one or more hits marked. The stored `active` flag is left untouched so
   * disabling the setting restores the plain toggles.
   */
  prepareDerivedData() {
    try {
      if (game.settings.get("foundryvtt-nco", "conditionTraumaTracksEnabled")) {
        this.active = (this.hits ?? 0) > 0;
      }
    } catch (e) {
      // Settings not registered yet (e.g. during early document prep).
    }
  }
}
