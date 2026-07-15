import { NCORoll } from "./dice/nco-roll.js";
import { CharacterData } from "./data/character-data.js";
import { ThreatData } from "./data/threat-data.js";
import { VehicleData } from "./data/vehicle-data.js";
import { SceneData } from "./data/scene-data.js";
import { JobData } from "./data/job-data.js";
import { ConditionData } from "./data/condition-data.js";
import { TrademarkData } from "./data/trademark-data.js";
import { GearData } from "./data/gear-data.js";
import { CharacterSheet } from "./sheets/character-sheet.js";
import { ThreatSheet } from "./sheets/threat-sheet.js";
import { VehicleSheet } from "./sheets/vehicle-sheet.js";
import { SceneSheet } from "./sheets/scene-sheet.js";
import { JobSheet } from "./sheets/job-sheet.js";
import { TrademarkSheet } from "./sheets/trademark-sheet.js";
import { GearSheet } from "./sheets/gear-sheet.js";
import { ConditionSheet } from "./sheets/condition-sheet.js";
import { NCORollDialog } from "./applications/nco-roll-dialog.js";
import { LineDefaultsMenu } from "./applications/line-defaults.js";
import { NCOCombat, NCOCombatant } from "./combat/nco-combat.js";
import { NCOCombatTracker } from "./combat/nco-combat-tracker.js";
import { GlobalRollPool } from "./global-roll-pool.js";
import { PressureTrack } from "./pressure-track.js";
import { PressureApp } from "./applications/pressure-app.js";
import { Tags } from "./tags.js";
import { Migrations } from "./migrations.js";
import { registerDiceSoNice } from "./dice/dice-so-nice.js";
import {
  GAME_LINES,
  DEFAULT_GAME_LINE,
  getGameLine,
  gameLineChoices,
  gameLineThemeClass,
  applyGameLineTerms,
} from "./config.js";

// Matches: /r a4d5  or  /r a4  (danger count optional)
const NCO_CHAT_PATTERN = /^\/r\s+a(\d+)(?:d(\d+))?\s*$/i;

Hooks.once("init", function () {
  game.nco = { NCORoll, NCORollDialog, GlobalRollPool, PressureTrack, Tags };
  CONFIG.NCO = { gameLines: GAME_LINES };

  // The active game line drives the visual theme and terminology (see config.js).
  // Changing it re-skins every sheet and chat card, so a reload is required.
  game.settings.register("foundryvtt-nco", "gameLine", {
    name: "NCO.Settings.GameLine.Name",
    hint: "NCO.Settings.GameLine.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: gameLineChoices(),
    default: DEFAULT_GAME_LINE,
    requiresReload: true,
  });

  CONFIG.Actor.dataModels.character = CharacterData;
  CONFIG.Actor.dataModels.threat = ThreatData;
  CONFIG.Actor.dataModels.vehicle = VehicleData;
  CONFIG.Item.dataModels.condition = ConditionData;
  CONFIG.Item.dataModels.trademark = TrademarkData;
  CONFIG.Item.dataModels.gear = GearData;
  // Scenes and Jobs are Items (not Actors): they have no token/canvas presence
  // and live in folders and compendia alongside the Scenes a Job references.
  CONFIG.Item.dataModels.scene = SceneData;
  CONFIG.Item.dataModels.job = JobData;

  foundry.documents.collections.Actors.registerSheet("foundryvtt-nco", CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "NCO.Sheet.Character",
  });

  foundry.documents.collections.Actors.registerSheet("foundryvtt-nco", ThreatSheet, {
    types: ["threat"],
    makeDefault: true,
    label: "NCO.Sheet.Threat",
  });

  foundry.documents.collections.Actors.registerSheet("foundryvtt-nco", VehicleSheet, {
    types: ["vehicle"],
    makeDefault: true,
    label: "NCO.Sheet.Vehicle",
  });

  foundry.documents.collections.Items.registerSheet("foundryvtt-nco", SceneSheet, {
    types: ["scene"],
    makeDefault: true,
    label: "NCO.Sheet.Scene",
  });

  foundry.documents.collections.Items.registerSheet("foundryvtt-nco", JobSheet, {
    types: ["job"],
    makeDefault: true,
    label: "NCO.Sheet.Job",
  });

  foundry.documents.collections.Items.registerSheet("foundryvtt-nco", TrademarkSheet, {
    types: ["trademark"],
    makeDefault: true,
    label: "NCO.Sheet.Trademark",
  });

  foundry.documents.collections.Items.registerSheet("foundryvtt-nco", GearSheet, {
    types: ["gear"],
    makeDefault: true,
    label: "NCO.Sheet.Gear",
  });

  foundry.documents.collections.Items.registerSheet("foundryvtt-nco", ConditionSheet, {
    types: ["condition"],
    makeDefault: true,
    label: "NCO.Sheet.Condition",
  });

  // One-click application of the active game line's recommended optional
  // rules (see `settings` in config.js). Menus render above the settings list.
  game.settings.registerMenu("foundryvtt-nco", "lineDefaults", {
    name: "NCO.Settings.LineDefaults.Name",
    label: "NCO.Settings.LineDefaults.Label",
    hint: "NCO.Settings.LineDefaults.Hint",
    icon: "fas fa-wand-magic-sparkles",
    type: LineDefaultsMenu,
    restricted: true,
  });

  // Visible settings are listed in registration order, most impactful first:
  // rule toggles, then their track lengths / numeric knobs, then UI behavior.

  // Optional phase-based initiative: PCs roll a d6 to act before (4+) or
  // after (3-) the Threats, and the combat tracker becomes three color-coded
  // phase sections with per-combatant "turn taken" toggles instead of a
  // numeric turn order. Swapping document and tracker classes requires a
  // reload; when disabled, Foundry's stock initiative is untouched.
  game.settings.register("foundryvtt-nco", "phaseInitiative", {
    name: "NCO.Settings.PhaseInitiative.Name",
    hint: "NCO.Settings.PhaseInitiative.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });

  if (game.settings.get("foundryvtt-nco", "phaseInitiative")) {
    CONFIG.Combat.documentClass = NCOCombat;
    CONFIG.Combatant.documentClass = NCOCombatant;
    CONFIG.ui.combat = NCOCombatTracker;
  }

  // Whether suffering a new Trauma automatically rolls a death check.
  game.settings.register("foundryvtt-nco", "deathCheckEnabled", {
    name: "NCO.Settings.DeathCheck.Name",
    hint: "NCO.Settings.DeathCheck.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // Pressure (optional rule): enabled toggle + track length.
  PressureTrack.registerSettings();
  PressureTrack.registerSocket();

  // Whether the optional Drive track appears on character sheets.
  game.settings.register("foundryvtt-nco", "driveTrackEnabled", {
    name: "NCO.Settings.DriveTrack.Name",
    hint: "NCO.Settings.DriveTrack.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });

  // Whether the optional Stash track appears on character sheets.
  game.settings.register("foundryvtt-nco", "stashTrackEnabled", {
    name: "NCO.Settings.StashTrack.Name",
    hint: "NCO.Settings.StashTrack.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });

  // How many Stash boxes appear on each character's Stash track.
  game.settings.register("foundryvtt-nco", "stashTrackLength", {
    name: "NCO.Settings.StashTrackLength.Name",
    hint: "NCO.Settings.StashTrackLength.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 20, step: 1 },
    default: 5,
    requiresReload: true,
  });

  // Whether the optional Ties (relationships) freeform box appears on sheets.
  game.settings.register("foundryvtt-nco", "tiesEnabled", {
    name: "NCO.Settings.Ties.Name",
    hint: "NCO.Settings.Ties.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
  });

  // Whether the optional Advantages freeform box appears on sheets.
  game.settings.register("foundryvtt-nco", "advantagesEnabled", {
    name: "NCO.Settings.Advantages.Name",
    hint: "NCO.Settings.Advantages.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
  });

  game.settings.register("foundryvtt-nco", "startingHits", {
    name: "NCO.Settings.StartingHits.Name",
    hint: "NCO.Settings.StartingHits.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 6, step: 1 },
    default: 3,
  });

  game.settings.register("foundryvtt-nco", "maxHits", {
    name: "NCO.Settings.MaxHits.Name",
    hint: "NCO.Settings.MaxHits.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 6, step: 1 },
    default: 4,
    requiresReload: true,
  });

  // How a Boss Threat's Hits track extends past a normal Threat's: tripled
  // (NCO) or plus one Hit per player character (Star Scoundrels). Feeds
  // ThreatData.prepareDerivedData, so already-loaded Threats need a reload.
  game.settings.register("foundryvtt-nco", "bossHitsMode", {
    name: "NCO.Settings.BossHitsMode.Name",
    hint: "NCO.Settings.BossHitsMode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      multiply: "NCO.Settings.BossHitsMode.Multiply",
      addPCs: "NCO.Settings.BossHitsMode.AddPCs",
    },
    default: "multiply",
    requiresReload: true,
  });

  // How many PCs are in the crew, for the per-PC Boss Hits mode above.
  game.settings.register("foundryvtt-nco", "pcCount", {
    name: "NCO.Settings.PCCount.Name",
    hint: "NCO.Settings.PCCount.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 4,
    requiresReload: true,
  });

  game.settings.register("foundryvtt-nco", "startingStuntPoints", {
    name: "NCO.Settings.StartingStuntPoints.Name",
    hint: "NCO.Settings.StartingStuntPoints.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 5, step: 1 },
    default: 3,
  });

  game.settings.register("foundryvtt-nco", "xpTrackLength", {
    name: "NCO.Settings.XPTrackLength.Name",
    hint: "NCO.Settings.XPTrackLength.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 5, max: 30, step: 1 },
    default: 15,
    requiresReload: true,
  });

  // Controls how the Hits and XP tracks respond to clicks (see CharacterSheet).
  game.settings.register("foundryvtt-nco", "trackClickMode", {
    name: "NCO.Settings.TrackClickMode.Name",
    hint: "NCO.Settings.TrackClickMode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      increment: "NCO.Settings.TrackClickMode.Increment",
      fill: "NCO.Settings.TrackClickMode.Fill",
    },
    default: "increment",
  });

  // startingConditions and stuntPointOptions are registered later, in the
  // i18nInit hook: their defaults are localized lists, and translations (plus
  // the active game line's term overrides) aren't loaded yet during init.
  // Registration order puts them at the end of the settings list.

  // Hidden (config: false) settings; their order doesn't matter.
  GlobalRollPool.registerSettings();
  GlobalRollPool.registerSocket();
  NCORollDialog.registerSettings();
  Migrations.registerSettings();

  registerDiceSoNice();

  // Foundry's built-in "Create Actor" dialog only fills in a default `type`
  // when more than one sub-type is registered (Actor disallows the "base"
  // type, so a system with a single sub-type ends up with no type selector
  // at all). Default new Actors to "character" so creation works normally.
  const documentClass = CONFIG.Actor.documentClass;
  const baseCreateDialog = documentClass.createDialog;
  documentClass.createDialog = function (data = {}, ...args) {
    return baseCreateDialog.call(this, { type: "character", ...data }, ...args);
  };
});

// Apply the active game line as early as the translations exist (before any
// sheet renders): merge its terminology overrides over the base English strings
// and tag <body> with its theme class, so the token overrides in
// styles/themes.css cascade into every sheet, dialog, chat card and dice roll
// without a flash of the default theme.
Hooks.once("i18nInit", function () {
  const line = game.settings.get("foundryvtt-nco", "gameLine");
  applyGameLineTerms(line);
  document.body.classList.add(gameLineThemeClass(line));

  // Scopes the phase-tracker CSS (styles/nco.css) so it can't leak into the
  // stock tracker when the optional rule is off; also hides the footer's
  // turn-step buttons, which have no meaning in phase play.
  if (game.settings.get("foundryvtt-nco", "phaseInitiative")) {
    document.body.classList.add("nco-phase-initiative");
  }

  // Registered here (not in init) so their prefilled defaults can be localized
  // — translations and the active game line's term overrides are applied above.
  // Both are edited as textareas (see the renderSettingsConfig hook below); a
  // GM may add, remove or reword entries one per line.

  // The Conditions each new character is seeded with (see the preCreateActor
  // hook). Clearing the list starts new characters with none. The default is
  // the active game line's list (see `conditions` in config.js), falling back
  // to the base NCO set.
  const conditionKeys = getGameLine(line).conditions ?? DEFAULT_CONDITIONS;
  game.settings.register("foundryvtt-nco", "startingConditions", {
    name: "NCO.Settings.StartingConditions.Name",
    hint: "NCO.Settings.StartingConditions.Hint",
    scope: "world",
    config: true,
    type: String,
    default: conditionKeys.map((key) => game.i18n.localize(`NCO.Condition.${key}`)).join("\n"),
  });

  // The ways a spent Stunt Point may be used, listed in chat when a character
  // spends one (see CharacterSheet._onSpendStuntPoint).
  game.settings.register("foundryvtt-nco", "stuntPointOptions", {
    name: "NCO.Settings.StuntPointOptions.Name",
    hint: "NCO.Settings.StuntPointOptions.Hint",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_STUNT_OPTIONS.map((key) =>
      game.i18n.localize(`NCO.Chat.StuntPoint.Option${key}`),
    ).join("\n"),
  });
});

// Render the multi-line list settings as textareas rather than single-line
// inputs, so their newline-separated entries are comfortable to edit.
const TEXTAREA_SETTINGS = ["startingConditions", "stuntPointOptions"];
Hooks.on("renderSettingsConfig", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  for (const key of TEXTAREA_SETTINGS) {
    const input = root.querySelector(`[name="foundryvtt-nco.${key}"]`);
    if (!input || input.tagName === "TEXTAREA") continue;
    const textarea = document.createElement("textarea");
    textarea.name = input.name;
    // Don't copy input.value: the single-line <input type="text"> Foundry
    // rendered has already stripped the newlines from it. Read the stored
    // setting, which still has them.
    textarea.value = game.settings.get("foundryvtt-nco", key);
    textarea.rows = 4;
    for (const cls of input.classList) textarea.classList.add(cls);
    input.replaceWith(textarea);
  }
});

// Every new character starts with a configurable set of (unmarked) Conditions.
// DEFAULT_CONDITIONS is the built-in list and the default for the
// `startingConditions` setting, unless the active game line declares its own
// `conditions` list (see config.js); a GM can edit that setting to change the
// set. Skip actors that already carry items, e.g. duplicates and imports.
const DEFAULT_CONDITIONS = ["Angry", "Exhausted", "Restrained", "Dazed", "Scared", "Weakened"];

// The standard Stunt Point uses, keyed by their NCO.Chat.StuntPoint.Option*
// i18n strings; the default for the `stuntPointOptions` setting.
const DEFAULT_STUNT_OPTIONS = ["Trademark", "Soak", "Adjust", "Detail"];

Hooks.on("preCreateActor", (actor, data) => {
  if (actor.type !== "character" || data.items?.length) return;
  // Split on commas or newlines so the setting accepts either style.
  const names = game.settings
    .get("foundryvtt-nco", "startingConditions")
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter((name) => name.length);
  if (!names.length) return;
  actor.updateSource({
    items: names.map((name) => ({
      name,
      type: "condition",
      img: "icons/svg/downgrade.svg",
    })),
  });
});

// Per-type default portraits, applied when a new Item is created without an
// explicit image (i.e. it still carries Foundry's generic placeholder). Scenes
// and Jobs are Items (see the data-model registration above).
const DEFAULT_ICONS = {
  job: "icons/svg/hanging-sign.svg",
  scene: "icons/svg/village.svg",
};

Hooks.on("preCreateItem", (item, data) => {
  const icon = DEFAULT_ICONS[item.type];
  if (!icon) return;
  if (data.img && data.img !== foundry.documents.BaseItem.DEFAULT_ICON) return;
  item.updateSource({ img: icon });
});

// Show the Pressure display (if the optional rule is enabled) once the UI
// exists, and stamp/migrate the world on the designated GM client. The "NCO
// Roll" convenience macro ships in the system's Macros compendium.
Hooks.once("ready", function () {
  PressureApp.refresh();
  Migrations.migrateWorld();
});

// Add a "NCO Roll" tool to the token controls so the GM and players alike
// always have one-click access to the global roll dialog from the canvas.
Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = controls.tokens ?? controls.token;
  if (!tokenControls) return;
  tokenControls.tools ??= {};
  tokenControls.tools["nco-roll"] = {
    name: "nco-roll",
    order: 99,
    title: "NCO.RollDialog.OpenTool",
    icon: "fas fa-dice-d6",
    button: true,
    onChange: () => NCORollDialog.open(),
    onClick: () => NCORollDialog.open(),
  };
});

Hooks.on("chatMessage", (_chatLog, message, _chatData) => {
  // The chat editor hands us HTML (e.g. "<p>/r a4d6</p>"), not plain text —
  // strip tags before testing against the command pattern.
  const text = message.replace(/<[^>]*>/g, "").trim();
  const match = text.match(NCO_CHAT_PATTERN);
  if (!match) return true;

  const actionCount = parseInt(match[1]);
  const dangerCount = match[2] ? parseInt(match[2]) : 0;
  new NCORoll(actionCount, dangerCount).toMessage();
  return false; // prevent Foundry from processing the command further
});
