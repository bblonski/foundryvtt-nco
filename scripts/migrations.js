const SYSTEM_ID = "foundryvtt-nco";
const SETTING = "systemVersion";

/**
 * Migration scaffolding.
 *
 * The world remembers which system version last touched it (a hidden world
 * setting), so a future release that changes stored data shapes can detect
 * out-of-date worlds and rewrite their documents once, on one client.
 *
 * There are no data migrations yet — this exists so pre-1.0 worlds are already
 * stamped when the first real migration ships.
 */
export class Migrations {
  static registerSettings() {
    game.settings.register(SYSTEM_ID, SETTING, {
      scope: "world",
      config: false,
      type: String,
      default: "",
    });
  }

  /**
   * Run any pending migrations, then stamp the world with the current system
   * version. Runs on the one designated GM client (world settings and every
   * document are writable there); call from the `ready` hook.
   */
  static async migrateWorld() {
    if (!game.users.activeGM?.isSelf) return;
    const from = game.settings.get(SYSTEM_ID, SETTING);
    const current = game.system.version;
    if (from === current) return;

    // Future migrations go here, oldest first, each gated on the stored
    // version, e.g.:
    //   if (!from || foundry.utils.isNewerVersion("1.1.0", from)) await this.#migrateTo110();

    await game.settings.set(SYSTEM_ID, SETTING, current);
  }
}
