/**
 * Dice So Nice integration: two custom colorsets so the 3D dice match the
 * chat card — Action dice in the active theme's accent color, Danger dice in
 * its hazard color. NCORoll tags each term with the matching colorset via
 * `die.options.appearance` (see nco-roll.js).
 *
 * The colors are sampled from the theme tokens on <body> at registration time,
 * so every game line's dice match its palette. The diceSoNiceReady hook only
 * fires when the module is active, so this is inert without it.
 */

/** Resolve a space-separated RGB channel token (e.g. "35 213 229") to hex. */
function themeChannelHex(name, fallback) {
  const raw = getComputedStyle(document.body).getPropertyValue(name).trim();
  const match = raw.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
  if (!match) return fallback;
  return `#${match
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Resolve a plain color token (already a CSS color, e.g. "#fff"). */
function themeColor(name, fallback) {
  return getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
}

export function registerDiceSoNice() {
  Hooks.once("diceSoNiceReady", (dice3d) => {
    const category = "Action Tales";
    const action = themeChannelHex("--nco-action-rgb", "#23d5e5");
    const danger = themeChannelHex("--nco-danger-rgb", "#ff2e88");

    dice3d.addColorset(
      {
        name: "nco-action",
        description: game.i18n.localize("NCO.Dice.ActionColorset"),
        category,
        foreground: themeColor("--nco-on-accent", "#ffffff"),
        background: action,
        outline: action,
        edge: action,
        material: "metal",
      },
      "default",
    );

    dice3d.addColorset(
      {
        name: "nco-danger",
        description: game.i18n.localize("NCO.Dice.DangerColorset"),
        category,
        foreground: themeColor("--nco-on-danger", "#0a0c18"),
        background: danger,
        outline: danger,
        edge: danger,
        material: "metal",
      },
      "default",
    );
  });
}
