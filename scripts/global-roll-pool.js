import { NCORollDialog } from "./applications/nco-roll-dialog.js";

const SYSTEM_ID = "foundryvtt-nco";
const SETTING = "globalRollPool";
const SOCKET = `system.${SYSTEM_ID}`;

/**
 * The shared dice pool behind the global roll dialog.
 *
 * State lives in a world-scoped setting so it persists and is identical for
 * every connected client. Only GMs may write world settings, so player
 * mutations are relayed over the system socket and applied by the active GM;
 * the resulting setting change is broadcast by the server and every client's
 * onChange handler re-renders (or opens) its roll dialog.
 *
 * Pool entries: { key, type: "action"|"danger", text, source }
 */
export class GlobalRollPool {
  /** @returns {{action: object[], danger: object[]}} */
  static get state() {
    const state = game.settings.get(SYSTEM_ID, SETTING);
    return {
      action: Array.isArray(state?.action) ? state.action : [],
      danger: Array.isArray(state?.danger) ? state.danger : [],
    };
  }

  static registerSettings() {
    game.settings.register(SYSTEM_ID, SETTING, {
      scope: "world",
      config: false,
      type: Object,
      default: { action: [], danger: [] },
      onChange: (value) => {
        const open = foundry.applications.instances.get("nco-roll-dialog");
        if (open?.rendered) open.render();
        else if (value?.action?.length || value?.danger?.length) NCORollDialog.open();
      },
    });
  }

  static registerSocket() {
    game.socket.on(SOCKET, (change) => {
      // The system socket is shared; ignore traffic tagged for another feature
      // (e.g. the Pressure track).
      if (change?.channel) return;
      // Apply exactly once, on the designated active GM's client.
      if (game.users.activeGM?.isSelf) this.#apply(change);
    });
  }

  /**
   * Add a die to the shared pool.
   * @param {"action"|"danger"} type
   * @param {string} text     The Trademark or tag text being invoked
   * @param {string} [source] The name of the character it came from
   */
  static async add(type, text, source = "") {
    return this.addMany(type, text, source, 1);
  }

  /**
   * Add `count` identical dice to the shared pool in a single write. Adding them
   * one at a time would relay `count` separate socket messages that race on the
   * GM (each reads the pool before the previous write lands, so all but the last
   * die is lost); batching keeps a multi-die invoke atomic.
   * @param {"action"|"danger"} type
   * @param {string} text     The Trademark or tag text being invoked
   * @param {string} [source] The name of the character it came from
   * @param {number} [count]  How many dice to add (e.g. a Danger Rating).
   */
  static async addMany(type, text, source = "", count = 1) {
    if (!text?.trim()) return;
    const n = Math.max(1, Math.trunc(count) || 1);
    const entries = Array.from({ length: n }, () => ({
      key: foundry.utils.randomID(8),
      type,
      text: text.trim(),
      source,
    }));
    return this.#submit({ op: "add", entries });
  }

  /** Remove the entry with the given key from whichever pool holds it. */
  static async remove(key) {
    return this.#submit({ op: "remove", key });
  }

  /** Empty both pools (used after a roll, or via the Clear button). */
  static async clear() {
    return this.#submit({ op: "clear" });
  }

  /** Apply a change directly if we are a GM, otherwise relay it to one. */
  static async #submit(change) {
    if (game.user.isGM) return this.#apply(change);
    if (!game.users.activeGM) {
      ui.notifications.warn(game.i18n.localize("NCO.RollDialog.NoGM"));
      return;
    }
    game.socket.emit(SOCKET, change);
  }

  /**
   * Tail of the serialized apply chain. Writing the pool is a read-modify-write
   * against an async world setting, so concurrent applies (e.g. several relayed
   * socket messages arriving together) would each read the pre-write state and
   * clobber one another. Chaining every apply through this promise guarantees
   * each one sees the previous write.
   * @type {Promise<unknown>}
   */
  static #queue = Promise.resolve();

  /** Enqueue a change so applies run strictly one at a time. */
  static #apply(change) {
    this.#queue = this.#queue.then(
      () => this.#applyNow(change),
      () => this.#applyNow(change),
    );
    return this.#queue;
  }

  static async #applyNow(change) {
    const state = foundry.utils.deepClone(this.state);
    switch (change.op) {
      case "add": {
        // Accept a batch (`entries`) or a single `entry` (older relayed messages).
        const entries = change.entries ?? (change.entry ? [change.entry] : []);
        for (const entry of entries) {
          const pool = entry?.type === "danger" ? state.danger : state.action;
          pool.push(entry);
        }
        break;
      }
      case "remove": {
        for (const pool of [state.action, state.danger]) {
          const index = pool.findIndex((e) => e.key === change.key);
          if (index >= 0) pool.splice(index, 1);
        }
        break;
      }
      case "clear":
        state.action = [];
        state.danger = [];
        break;
      default:
        return;
    }
    return game.settings.set(SYSTEM_ID, SETTING, state);
  }
}
