import { PHASES } from "./nco-combat.js";

/**
 * Combat tracker for phase-based initiative: renders the encounter as three
 * color-coded sections (before Threats / Threats / after Threats, plus a
 * holding section for PCs who haven't rolled their phase die yet) instead of
 * a numeric turn order. Where the initiative number would normally sit, each
 * combatant gets a "turn taken" toggle that the GM or an owning player clicks
 * once that combatant has acted this round.
 */

const SYSTEM_ID = "foundryvtt-nco";

const PHASE_LABELS = {
  unassigned: "NCO.Combat.PhaseUnassigned",
  before: "NCO.Combat.PhaseBefore",
  threats: "NCO.Combat.PhaseThreats",
  after: "NCO.Combat.PhaseAfter",
};

export class NCOCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  static DEFAULT_OPTIONS = {
    actions: {
      toggleTurnTaken: NCOCombatTracker.#onToggleTurnTaken,
    },
  };

  /** Swap in our phase-grouped tracker body; the header and footer are stock. */
  static PARTS = {
    ...super.PARTS,
    tracker: {
      template: `systems/${SYSTEM_ID}/templates/combat/tracker.hbs`,
      scrollable: [""],
    },
  };

  /** Group the prepared turns into phase sections for the template. */
  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options);
    if (!context.turns) return;
    const phases = PHASES.map((key) => ({
      key,
      label: game.i18n.localize(PHASE_LABELS[key]),
      turns: context.turns.filter((t) => t.phase === key),
    }));
    // The pre-roll holding section only appears while someone is actually in
    // it; the three real phases always show so the round structure is visible.
    context.phases = phases.filter((p) => p.key !== "unassigned" || p.turns.length);
  }

  /** Decorate each turn with its phase and turn-taken state. */
  async _prepareTurnContext(combat, combatant, index) {
    const turn = await super._prepareTurnContext(combat, combatant, index);
    turn.phase = combatant.phase;
    turn.turnTaken = combatant.turnTaken;
    turn.showRoll = turn.phase === "unassigned" && turn.isOwner;
    // No single combatant is ever "current" in phase play — rebuild the css
    // without the active highlight the core class assigned to turns[turn].
    turn.active = false;
    turn.css = [
      turn.hidden ? "hide" : null,
      turn.isDefeated ? "defeated" : null,
      `nco-phase-${turn.phase}`,
      turn.turnTaken ? "nco-turn-taken" : null,
    ].filterJoin(" ");
    return turn;
  }

  /**
   * Flip a combatant's turn-taken flag. Foundry lets non-GM users update a
   * Combatant they own as long as the change only touches whitelisted keys
   * (flags are whitelisted), so owning players toggle directly — no GM relay.
   */
  static async #onToggleTurnTaken(_event, target) {
    const id = target.closest("[data-combatant-id]")?.dataset.combatantId;
    const combatant = this.viewed?.combatants.get(id);
    if (!combatant?.isOwner) return;
    await combatant.update({ [`flags.${SYSTEM_ID}.turnTaken`]: !combatant.turnTaken });
  }
}
