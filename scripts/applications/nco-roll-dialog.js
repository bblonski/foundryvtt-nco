import { NCORoll } from "../dice/nco-roll.js";
import { GlobalRollPool } from "../global-roll-pool.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The global Neon City Overdrive roll window.
 *
 * A singleton per client, rendered from the shared GlobalRollPool state so
 * every player sees the same pending roll. Dice are added by clicking
 * Trademarks and Edges on character sheets (players add Action dice, the GM
 * adds Danger dice); clicking an entry here removes it again. Roll throws
 * (action entries + 1) Action dice against (danger entries) Danger dice and
 * clears the pool for the next check.
 */
export class NCORollDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "nco-roll-dialog",
    classes: ["nco", "roll-dialog"],
    window: { title: "NCO.RollDialog.Title", icon: "fas fa-dice-d6" },
    position: { width: 460, height: "auto" },
    actions: {
      removeDie: this._onRemoveDie,
      clear: this._onClear,
      roll: this._onRoll,
    },
  };

  static PARTS = {
    content: { template: "systems/foundryvtt-nco/templates/dice/roll-dialog.hbs" },
  };

  /** Open the dialog, reusing and focusing an existing instance rather than stacking duplicates. */
  static open() {
    const existing = foundry.applications.instances.get("nco-roll-dialog");
    const dialog = existing instanceof NCORollDialog ? existing : new NCORollDialog();
    return dialog.render({ force: true });
  }

  /** @override */
  async _prepareContext(_options) {
    const { action, danger } = GlobalRollPool.state;
    return {
      action,
      danger,
      actionTotal: action.length + 1,
      dangerTotal: danger.length,
    };
  }

  /** Remove a die from the shared pool by clicking it in the list. */
  static _onRemoveDie(_event, target) {
    return GlobalRollPool.remove(target.dataset.key);
  }

  /** Empty both pools without rolling. */
  static _onClear(_event, _target) {
    return GlobalRollPool.clear();
  }

  /** Roll the assembled dice pools, post the result to chat, and reset the pool. */
  static async _onRoll(_event, _target) {
    const { action, danger } = GlobalRollPool.state;
    const roll = new NCORoll(action.length + 1, danger.length, {
      edges: {
        action: action.map((e) => e.text),
        danger: danger.map((e) => e.text),
      },
    });
    await roll.toMessage();
    await GlobalRollPool.clear();
  }
}
