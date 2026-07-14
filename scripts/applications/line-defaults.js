import { getGameLine } from "../config.js";
import { escapeHTML } from "../lib/lib.js";

const SYSTEM_ID = "foundryvtt-nco";

/**
 * The "Apply Recommended Settings" button in the settings sidebar.
 *
 * Each game line declares recommended values for the optional rules (see
 * `settings` in config.js). Registered as a settings menu, which requires an
 * Application class — but the whole interaction is a single confirm dialog, so
 * `render()` runs the confirm-and-apply flow instead of opening a window.
 */
export class LineDefaultsMenu extends foundry.applications.api.ApplicationV2 {
  /** @override Invoked by the settings sheet's menu button. */
  async render(_options) {
    await LineDefaultsMenu.apply();
    return this;
  }

  /** Confirm and apply the active game line's recommended optional rules. */
  static async apply() {
    const line = getGameLine(game.settings.get(SYSTEM_ID, "gameLine"));
    const recommended = line.settings ?? {};

    // One row per optional rule, using the setting's own (term-overridden)
    // display name, with the rules already matching marked as such. Toggles
    // show On/Off; choice settings show the recommended choice's label.
    const rows = Object.entries(recommended).map(([key, value]) => {
      const config = game.settings.settings.get(`${SYSTEM_ID}.${key}`);
      const name = game.i18n.localize(config?.name ?? key);
      const state =
        typeof value === "boolean"
          ? game.i18n.localize(
              value ? "NCO.Settings.LineDefaults.On" : "NCO.Settings.LineDefaults.Off",
            )
          : game.i18n.localize(config?.choices?.[value] ?? String(value));
      const unchanged =
        game.settings.get(SYSTEM_ID, key) === value
          ? ` <em>(${game.i18n.localize("NCO.Settings.LineDefaults.Unchanged")})</em>`
          : "";
      return `<li>${escapeHTML(name)}: <strong>${state}</strong>${unchanged}</li>`;
    });

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("NCO.Settings.LineDefaults.Title") },
      content: `
        <p>${game.i18n.format("NCO.Settings.LineDefaults.Prompt", {
          line: escapeHTML(line.label),
        })}</p>
        <ul>${rows.join("")}</ul>`,
    });
    if (!confirmed) return;

    let needsReload = false;
    for (const [key, value] of Object.entries(recommended)) {
      if (game.settings.get(SYSTEM_ID, key) === value) continue;
      await game.settings.set(SYSTEM_ID, key, value);
      needsReload ||= !!game.settings.settings.get(`${SYSTEM_ID}.${key}`)?.requiresReload;
    }

    // The settings sheet is still open behind the dialog with the old values
    // in its form; refresh it so a later "Save Changes" can't revert them.
    foundry.applications.instances.get("settings-config")?.render();

    // game.settings.set does not prompt for the reload that requiresReload
    // settings need (only the settings form does), so prompt explicitly.
    if (needsReload) {
      await foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
    }
  }
}
