import { PressureApp } from "./applications/pressure-app.js";

const SYSTEM_ID = "foundryvtt-nco";
const SOCKET = `system.${SYSTEM_ID}`;

// Setting keys.
const ENABLED = "pressureEnabled";
const LENGTH = "pressureTrackLength";
const STATE = "pressure";

// Distinguishes our socket traffic from the GlobalRollPool's, since Foundry
// only gives the whole system a single `system.<id>` socket channel.
const CHANNEL = "pressure";

/**
 * The optional "Pressure" rule: a GM resource track shown to every player near
 * the top of the screen.
 *
 * Each uncancelled 6 on a Danger die ticks Pressure up by one, capped at the
 * configured track length. The GM can reset it at any time.
 *
 * Like the GlobalRollPool, the current value lives in a world-scoped setting so
 * it persists and is identical for every client. Only GMs may write world
 * settings, so player-triggered ticks are relayed over the system socket and
 * applied by the active GM; the broadcast setting change re-renders everyone's
 * display via the onChange handler.
 */
export class PressureTrack {
  static get enabled() {
    return game.settings.get(SYSTEM_ID, ENABLED);
  }

  static get max() {
    return game.settings.get(SYSTEM_ID, LENGTH);
  }

  /** Current Pressure, clamped to the (possibly reduced) track length. */
  static get value() {
    const raw = Number(game.settings.get(SYSTEM_ID, STATE)) || 0;
    return Math.max(0, Math.min(raw, this.max));
  }

  static registerSettings() {
    game.settings.register(SYSTEM_ID, ENABLED, {
      name: "NCO.Settings.Pressure.Name",
      hint: "NCO.Settings.Pressure.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      onChange: () => PressureApp.refresh(),
    });

    game.settings.register(SYSTEM_ID, LENGTH, {
      name: "NCO.Settings.PressureTrackLength.Name",
      hint: "NCO.Settings.PressureTrackLength.Hint",
      scope: "world",
      config: true,
      type: Number,
      range: { min: 1, max: 12, step: 1 },
      default: 6,
      onChange: () => PressureApp.refresh(),
    });

    game.settings.register(SYSTEM_ID, STATE, {
      scope: "world",
      config: false,
      type: Number,
      default: 0,
      onChange: () => PressureApp.refresh(),
    });
  }

  static registerSocket() {
    game.socket.on(SOCKET, (change) => {
      if (change?.channel !== CHANNEL) return; // not ours; let the roll pool handle it
      if (game.users.activeGM?.isSelf) this.#apply(change);
    });
  }

  /** Increase Pressure by `amount` points (capped at the track length). */
  static async add(amount = 1) {
    if (!(amount > 0)) return;
    return this.#submit({ op: "add", amount });
  }

  /** Set Pressure to an exact level (clamped to the track length). */
  static async set(level) {
    return this.#submit({ op: "set", level });
  }

  /** Clear the Pressure track back to zero. */
  static async reset() {
    return this.#submit({ op: "reset" });
  }

  /** Apply a change directly if we are a GM, otherwise relay it to one. */
  static async #submit(change) {
    const message = { channel: CHANNEL, ...change };
    if (game.user.isGM) return this.#apply(message);
    if (!game.users.activeGM) {
      ui.notifications.warn(game.i18n.localize("NCO.RollDialog.NoGM"));
      return;
    }
    game.socket.emit(SOCKET, message);
  }

  static async #apply(change) {
    let value = this.value;
    switch (change.op) {
      case "add":
        value = Math.min(this.max, value + change.amount);
        break;
      case "set":
        value = Math.max(0, Math.min(this.max, change.level));
        break;
      case "reset":
        value = 0;
        break;
      default:
        return;
    }
    return game.settings.set(SYSTEM_ID, STATE, value);
  }
}
