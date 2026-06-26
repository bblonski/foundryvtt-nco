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
    // Default to the top-right corner, clear of the scene navigation bar.
    position: { width: 540, height: "auto", top: 70, left: window.innerWidth - 800 },
    actions: {
      removeDie: this._onRemoveDie,
      addBonus: this._onAddBonus,
      addPenalty: this._onAddPenalty,
      clear: this._onClear,
      roll: this._onRoll,
    },
  };

  static PARTS = {
    content: { template: "systems/foundryvtt-nco/templates/dice/roll-dialog.hbs" },
  };

  /** Client-scoped store for the window's last position, so it reopens where the
   *  user left it instead of snapping back to the default corner. */
  static registerSettings() {
    game.settings.register("foundryvtt-nco", "rollDialogPosition", {
      scope: "client",
      config: false,
      type: Object,
      default: {},
    });
  }

  /** Open the dialog, reusing and focusing an existing instance rather than stacking duplicates. */
  static open() {
    const existing = foundry.applications.instances.get("nco-roll-dialog");
    const dialog = existing instanceof NCORollDialog ? existing : new NCORollDialog();
    return dialog.render({ force: true });
  }

  /** @override — seed the window with the remembered position (left/top only,
   *  so the height stays "auto"). */
  _initializeApplicationOptions(options) {
    const opts = super._initializeApplicationOptions(options);
    const saved = game.settings?.get("foundryvtt-nco", "rollDialogPosition");
    if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
      opts.position = { ...opts.position, left: saved.left, top: saved.top };
    }
    return opts;
  }

  /** @override — persist the window's position (debounced) whenever it moves. */
  setPosition(position) {
    const applied = super.setPosition(position);
    this.#savePosition(applied);
    return applied;
  }

  /** Debounced so a drag (many setPosition calls) writes the setting once. */
  #savePosition = foundry.utils.debounce((position) => {
    if (!Number.isFinite(position?.left) || !Number.isFinite(position?.top)) return;
    game.settings.set("foundryvtt-nco", "rollDialogPosition", {
      left: position.left,
      top: position.top,
    });
  }, 300);

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

  /** Add an ad-hoc Action die for a situational bonus. */
  static _onAddBonus(_event, _target) {
    return GlobalRollPool.add("action", game.i18n.localize("NCO.RollDialog.Bonus"));
  }

  /** Add an ad-hoc Danger die for a situational penalty. */
  static _onAddPenalty(_event, _target) {
    return GlobalRollPool.add("danger", game.i18n.localize("NCO.RollDialog.Penalty"));
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
