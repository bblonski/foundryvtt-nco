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
      // Filled boxes on each Trauma's optional three-box hit track, index-aligned
      // with `traumas` (missing entries read as 0). Shown when the world's
      // condition/trauma-tracks setting is enabled (e.g. Tomorrow City).
      traumaHits: new fields.ArrayField(
        new fields.NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 }),
      ),
      // Meta-currency spent for stunts; clicking the sheet label spends one
      // and posts the spending options to chat. Drawn as a Hits-like track
      // (filled boxes = available points) in blue. New characters start with
      // the world's starting-stunt-points setting (NCO default 3) and the pool
      // can grow to 5 through advancement.
      stuntPoints: new fields.SchemaField({
        value: new fields.NumberField({
          required: true,
          integer: true,
          min: 0,
          max: 5,
          initial: () => {
            try {
              return game.settings.get("foundryvtt-nco", "startingStuntPoints");
            } catch (e) {
              return 3;
            }
          },
        }),
        max: new fields.NumberField({
          required: true,
          integer: true,
          min: 1,
          max: 5,
          initial: () => {
            try {
              return game.settings.get("foundryvtt-nco", "startingStuntPoints");
            } catch (e) {
              return 3;
            }
          },
        }),
      }),
      // Advancement track: how many XP boxes are filled. The track's length
      // (total boxes) is a world setting, so it isn't stored per character;
      // the sheet clamps the display to that length.
      xp: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      // Tri-state XP track (optional; see the xpTriStateEnabled setting). Used
      // instead of the `xp` count above when that setting is on: each box cycles
      // empty (0) -> ticked (1) -> crossed (2) independently, like the Drive
      // track. Toggling the setting converts between the two shapes (see
      // convertXpTracks), so only one of them is ever authoritative.
      xpBoxes: new fields.ArrayField(
        new fields.NumberField({ required: true, integer: true, min: 0, max: 2, initial: 0 }),
        { initial: () => [] },
      ),
      // Stash track: how many Stash boxes are filled. Like XP, the track's
      // length is a world setting (optional, default 5) and isn't stored per
      // character; the sheet clamps the display to that length. Drawn in blue.
      stash: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      // Simple Gear: a freeform notes box for everyday equipment that doesn't
      // warrant its own Tags. Unique Gear (see GearData) is embedded Items with
      // their own positive and negative Tags, for items significant enough to
      // warrant that detail.
      gear: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      // Optional Ties box (off by default; toggled per world). Like Gear, this
      // is a plain freeform notes box — not invocable Tags — for game lines that
      // surface Ties/relationships (e.g. Hard City, Tomorrow City). Shown only
      // when its world setting is enabled.
      ties: new fields.HTMLField({ required: false, blank: true, initial: "" }),
      // Optional Advantages (off by default; toggled per world). A freeform
      // notes box like Gear/Ties — not invocable Tags — for game lines that
      // surface Advantages. Shown only when its world setting is enabled.
      advantages: new fields.HTMLField({ required: false, blank: true, initial: "" }),
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
    // Same counts for the optional tri-state XP track.
    const xpBoxes = this.xpBoxes ?? [];
    this.xpTicked = xpBoxes.filter((b) => b === 1).length;
    this.xpCrossed = xpBoxes.filter((b) => b === 2).length;
  }

  /**
   * Convert every character between the two XP track shapes when the
   * xpTriStateEnabled setting is toggled, so no advancement is lost either way.
   * Turning the option on ticks one box per stored XP point; turning it off
   * counts ticked and crossed boxes back into `xp` (both are spent XP). The
   * boxes are left in place when converting back, since turning the option on
   * again rebuilds them from `xp`.
   *
   * Called from the setting's onChange on the active GM only — world documents
   * are writable there, and every client reloads afterwards anyway.
   */
  static async convertXpTracks(enabled) {
    const length = Math.max(0, game.settings.get("foundryvtt-nco", "xpTrackLength") ?? 15);
    const convert = (actor) => {
      const system = actor.system;
      if (enabled) {
        const filled = Math.min(length, Math.max(0, system.xp ?? 0));
        const boxes = Array.from({ length }, (_, i) => (i < filled ? 1 : 0));
        return { _id: actor.id, "system.xpBoxes": boxes };
      }
      const boxes = (system.xpBoxes ?? []).slice(0, length);
      return { _id: actor.id, "system.xp": boxes.filter((b) => b === 1 || b === 2).length };
    };

    const characters = game.actors.filter((actor) => actor.type === "character");
    if (characters.length) {
      await CONFIG.Actor.documentClass.updateDocuments(characters.map(convert));
    }

    // Unlinked tokens carry their own copy of the actor data, so they need the
    // same conversion applied through each token's synthetic actor.
    for (const scene of game.scenes) {
      for (const token of scene.tokens) {
        if (token.actorLink || token.actor?.type !== "character") continue;
        const { _id, ...changes } = convert(token.actor);
        await token.actor.update(changes);
      }
    }
  }
}
