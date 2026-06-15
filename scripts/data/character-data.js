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
      // and posts the spending options to chat. Drawn as a Hits-like track
      // (filled boxes = available points) in blue. NCO characters start with
      // 3 and the pool can grow to 5 through advancement.
      stuntPoints: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, min: 0, max: 5, initial: 3 }),
        max: new fields.NumberField({ required: true, integer: true, min: 1, max: 5, initial: 3 }),
      }),
      // Advancement track: how many XP boxes are filled. The track's length
      // (total boxes) is a world setting, so it isn't stored per character;
      // the sheet clamps the display to that length.
      xp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      // Simple Gear: a freeform notes box for everyday equipment that doesn't
      // warrant its own Tags. Unique Gear (see GearData) is embedded Items with
      // their own positive and negative Tags, for items significant enough to
      // warrant that detail.
      gear: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      // Drive track: a description plus a fixed row of ten tri-state boxes. Each
      // box cycles empty (0) -> ticked (1) -> crossed (2). The number of ticked
      // and crossed boxes are derived character stats (see prepareDerivedData).
      // Optional in the sheet UI via the world's drive-track setting.
      drive: new fields.SchemaField({
        description: new fields.StringField({ required: true, blank: true, initial: "" }),
        boxes: new fields.ArrayField(
          new fields.NumberField({ required: true, integer: true, min: 0, max: 2, initial: 0 }),
          { initial: () => Array.from({ length: 10 }, () => 0) },
        ),
      }),
    };
  }

  /** @override */
  prepareDerivedData() {
    // Remaining hits, primarily for token resource bars.
    this.hits.value = Math.max(0, this.hits.max - this.hits.taken);
    // Ticked and crossed box counts on the Drive track, exposed as stats (e.g.
    // for token resource bars and macros).
    const driveBoxes = this.drive?.boxes ?? [];
    this.drive.ticked = driveBoxes.filter((b) => b === 1).length;
    this.drive.crossed = driveBoxes.filter((b) => b === 2).length;
  }
}
