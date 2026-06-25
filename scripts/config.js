/**
 * Game-line registry.
 *
 * The system ships one engine (the "Action Tales" rules) but supports several
 * settings/game lines. A game line is the single switch that controls a world's
 * presentation: which visual theme is applied (a `nco-theme-*` class added to
 * <body>; the palettes live in styles/themes.css) and which terminology
 * overrides are merged over the base English strings (languages/en.json).
 *
 * The core Action Tales vocabulary — Trademarks, Tags, Edges, Flaws, Action and
 * Danger dice, Stunt Points — is shared across every line, so the `terms` maps
 * below intentionally override only the setting-specific strings (product
 * titles, and any line that renames a concept). Add book-accurate overrides for
 * a line by dropping more `"<i18n key>": "<text>"` pairs into its `terms` map;
 * the available keys are whatever appears in languages/en.json.
 */

export const DEFAULT_GAME_LINE = "nco";

export const GAME_LINES = {
  nco: {
    label: "Neon City Overdrive",
    theme: "cyberpunk",
    // Base line: presentation matches languages/en.json as-shipped.
    terms: {},
  },

  "star-scoundrels": {
    label: "Star Scoundrels",
    theme: "space-opera",
    terms: {
      "NCO.Roll.Title": "Star Scoundrels · Check",
      "NCO.RollDialog.Title": "Star Scoundrels — Roll",
      "NCO.Sheet.StuntPoints": "Flow",
      "NCO.Sheet.SpendStuntPoint": "Click to spend a point of Flow",
      "NCO.Sheet.NoStuntPoints": "{name} has no Flow left to spend.",
      "NCO.Sheet.StuntPointsMax": "Total Flow for this character",
      "NCO.Chat.StuntPoint.Title": "Flow Spent",
      "NCO.Chat.StuntPoint.Remaining": "{name} has {remaining} Flow remaining.",
      "NCO.Settings.MaxHits.Name": "Grit",
      "NCO.Settings.MaxHits.Hint": "The most Hits any character can grow to through advancement — their Grit.",
      "NCO.Sheet.HitsMax": "Grit — total Hits for this character",
      "NCO.Sheet.UniqueGear": "Unique Gear",
      "NCO.Sheet.AddUniqueGear": "Unique Gear",
      "NCO.Sheet.EmptyUniqueGear": "No Unique Gear yet. Unlock edit mode and click \"Unique Gear\" to add one.",
    },
  },

  "dungeon-crawlers": {
    label: "Dungeon Crawlers",
    theme: "osr",
    terms: {
      "NCO.Roll.Title": "Dungeon Crawlers · Check",
      "NCO.RollDialog.Title": "Dungeon Crawlers — Roll",
    },
  },

  "hard-city": {
    label: "Hard City",
    theme: "noir",
    terms: {
      "NCO.Roll.Title": "Hard City · Check",
      "NCO.RollDialog.Title": "Hard City — Roll",
      "NCO.Sheet.StuntPoints": "Moxie",
      "NCO.Sheet.SpendStuntPoint": "Click to spend a point of Moxie",
      "NCO.Sheet.NoStuntPoints": "{name} has no Moxie left to spend.",
      "NCO.Sheet.StuntPointsMax": "Total Moxie for this character",
      "NCO.Chat.StuntPoint.Title": "Moxie Spent",
      "NCO.Chat.StuntPoint.Remaining": "{name} has {remaining} Moxie remaining.",
      "NCO.Settings.MaxHits.Name": "Grit",
      "NCO.Settings.MaxHits.Hint": "The most Hits any character can grow to through advancement — their Grit.",
      "NCO.Sheet.HitsMax": "Grit — total Hits for this character",
      "NCO.Sheet.Traumas": "Injuries",
      "NCO.Sheet.AddTrauma": "Injury",
      "NCO.Sheet.AddTraumaTitle": "New Injury",
      "NCO.Sheet.TraumaNamePlaceholder": "Injury…",
      "NCO.Sheet.DeleteTrauma": "Delete Injury",
      "NCO.Chat.DeathCheck.Suffered": "{name} suffered an Injury: {trauma}",
      "NCO.RollDialog.Hint": "Click Tags on character sheets to add dice — positive Tags (Trademarks, Edges) add Action dice; negative Tags (Flaws, Injuries, Conditions) add Danger dice. Shift-click to invert. This pool is shared by all players.",
      "NCO.Settings.DeathCheck.Name": "Death Check on Injury",
      "NCO.Settings.DeathCheck.Hint": "Automatically roll a death check when a character suffers a new Injury.",
    },
  },

  "tomorrow-city": {
    label: "Tomorrow City",
    theme: "dieselpunk",
    terms: {
      "NCO.Roll.Title": "Tomorrow City · Check",
      "NCO.RollDialog.Title": "Tomorrow City — Roll",
      "NCO.Sheet.StuntPoints": "Moxie",
      "NCO.Sheet.SpendStuntPoint": "Click to spend a point of Moxie",
      "NCO.Sheet.NoStuntPoints": "{name} has no Moxie left to spend.",
      "NCO.Sheet.StuntPointsMax": "Total Moxie for this character",
      "NCO.Chat.StuntPoint.Title": "Moxie Spent",
      "NCO.Chat.StuntPoint.Remaining": "{name} has {remaining} Moxie remaining.",
      "NCO.Settings.MaxHits.Name": "Grit",
      "NCO.Settings.MaxHits.Hint": "The most Hits any character can grow to through advancement — their Grit.",
      "NCO.Sheet.HitsMax": "Grit — total Hits for this character",
      "NCO.Sheet.Stash": "Cred",
      "NCO.Settings.StashTrack.Name": "Cred Track",
      "NCO.Settings.StashTrack.Hint": "Show the optional Cred track on character sheets.",
      "NCO.Settings.StashTrackLength.Name": "Cred Track Length",
      "NCO.Settings.StashTrackLength.Hint": "How many Cred boxes appear on each character's Cred track.",
      "NCO.Sheet.Traumas": "Injuries",
      "NCO.Sheet.AddTrauma": "Injury",
      "NCO.Sheet.AddTraumaTitle": "New Injury",
      "NCO.Sheet.TraumaNamePlaceholder": "Injury…",
      "NCO.Sheet.DeleteTrauma": "Delete Injury",
      "NCO.Chat.DeathCheck.Suffered": "{name} suffered an Injury: {trauma}",
      "NCO.RollDialog.Hint": "Click Tags on character sheets to add dice — positive Tags (Trademarks, Edges) add Action dice; negative Tags (Flaws, Injuries, Conditions) add Danger dice. Shift-click to invert. This pool is shared by all players.",
      "NCO.Settings.DeathCheck.Name": "Death Check on Injury",
      "NCO.Settings.DeathCheck.Hint": "Automatically roll a death check when a character suffers a new Injury.",
    },
  },
};

/** Resolve a line id to its registry entry, falling back to the default line. */
export function getGameLine(id) {
  return GAME_LINES[id] ?? GAME_LINES[DEFAULT_GAME_LINE];
}

/** The `nco-theme-*` body class for a line. */
export function gameLineThemeClass(id) {
  return `nco-theme-${getGameLine(id).theme}`;
}

/** A `{ lineId: label }` map for the settings dropdown. */
export function gameLineChoices() {
  return Object.fromEntries(Object.entries(GAME_LINES).map(([id, line]) => [id, line.label]));
}

/**
 * Merge the active line's terminology overrides onto the loaded translations.
 * The base strings use flat dotted keys (see languages/en.json), so each
 * override is assigned as a flat key — overriding the value Foundry returns
 * from `game.i18n.localize(key)`. Call during the `i18nInit` hook, after the
 * base translations have loaded but before any sheet renders.
 */
export function applyGameLineTerms(id) {
  const terms = getGameLine(id).terms;
  for (const [key, value] of Object.entries(terms)) {
    game.i18n.translations[key] = value;
  }
}
