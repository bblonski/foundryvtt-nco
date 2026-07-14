/**
 * Phase-based initiative (optional rule, see the `phaseInitiative` setting).
 *
 * Instead of a numeric turn order, a round is three phases: PCs who act
 * BEFORE the Threats, the Threats themselves, then PCs who act AFTER. A PC's
 * d6 initiative roll only decides their phase (4+ acts before, 3- after);
 * within a phase combatants act in any order they like, tracking who has
 * acted with a per-combatant "turn taken" flag (see NCOCombatTracker).
 *
 * Threats never roll: they always occupy the middle phase. Vehicles side with
 * whoever owns them — a friendly-disposition token rolls like a PC, anything
 * else (hostile, neutral, secret) is treated as a Threat.
 */

const SYSTEM_ID = "foundryvtt-nco";

/** Display order of the phases in the tracker. */
export const PHASES = ["unassigned", "before", "threats", "after"];
const PHASE_RANK = Object.fromEntries(PHASES.map((p, i) => [p, i]));

export class NCOCombatant extends foundry.documents.Combatant {
  /**
   * Does this combatant fight on the Threats' side of the round?
   * Threat actors always do; vehicles do unless their token disposition is
   * friendly (a neutral, hostile or secret vehicle is assumed GM-driven).
   */
  get isThreatSide() {
    const type = this.actor?.type;
    if (type === "threat") return true;
    if (type === "vehicle") {
      const disposition =
        this.token?.disposition ?? this.actor?.prototypeToken?.disposition ?? 0;
      return disposition < CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    }
    return false;
  }

  /**
   * Which phase this combatant acts in: "before" / "threats" / "after", or
   * "unassigned" for a PC-side combatant who hasn't rolled their d6 yet.
   */
  get phase() {
    if (this.isThreatSide) return "threats";
    if (!Number.isNumeric(this.initiative)) return "unassigned";
    return this.initiative >= 4 ? "before" : "after";
  }

  /** Whether this combatant has acted in the current round. */
  get turnTaken() {
    return !!this.getFlag(SYSTEM_ID, "turnTaken");
  }
}

export class NCOCombat extends foundry.documents.Combat {
  /** Order the tracker by phase, then alphabetically within each phase. */
  _sortCombatants(a, b) {
    const rank = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
    return rank || a.name.localeCompare(b.name) || (a.id > b.id ? 1 : -1);
  }

  /**
   * Threat-side combatants never roll initiative — their phase is fixed.
   * Filtering here covers every entry point at once: the per-combatant roll
   * button, Roll All / Roll NPCs, and the tracker context menu.
   */
  async rollInitiative(ids, options) {
    ids = typeof ids === "string" ? [ids] : ids;
    ids = ids.filter((id) => !this.combatants.get(id)?.isThreatSide);
    return super.rollInitiative(ids, options);
  }

  /**
   * Phase play has no meaningful "current turn" pointer, so any turn-stepping
   * input (the footer buttons are hidden, but keybinds and macros aren't)
   * advances the round instead.
   */
  async nextTurn() {
    return this.nextRound();
  }

  async previousTurn() {
    return this.previousRound();
  }

  /** A new round starts with a clean slate: clear every turn-taken flag.
   *  Runs on the one designated GM client, which has permission to update
   *  every combatant. */
  async _onStartRound(context) {
    await super._onStartRound(context);
    const updates = this.combatants
      .filter((c) => c.turnTaken)
      .map((c) => ({ _id: c.id, [`flags.${SYSTEM_ID}.turnTaken`]: false }));
    if (updates.length) await this.updateEmbeddedDocuments("Combatant", updates);
  }
}
