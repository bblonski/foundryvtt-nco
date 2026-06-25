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
import { GlobalRollPool } from "./global-roll-pool.js";
import { PressureTrack } from "./pressure-track.js";
import { PressureApp } from "./applications/pressure-app.js";
import { Tags } from "./tags.js";
import {
  GAME_LINES,
  DEFAULT_GAME_LINE,
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

  GlobalRollPool.registerSettings();
  GlobalRollPool.registerSocket();

  PressureTrack.registerSettings();
  PressureTrack.registerSocket();

  game.settings.register("foundryvtt-nco", "startingHits", {
    name: "NCO.Settings.StartingHits.Name",
    hint: "NCO.Settings.StartingHits.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 6, step: 1 },
    default: 3,
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

  // Whether suffering a new Trauma automatically rolls a death check.
  game.settings.register("foundryvtt-nco", "deathCheckEnabled", {
    name: "NCO.Settings.DeathCheck.Name",
    hint: "NCO.Settings.DeathCheck.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
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
});

// Every new character starts with the standard set of (unmarked) Conditions.
// Skip actors that already carry items, e.g. duplicates and imports.
const DEFAULT_CONDITIONS = ["Angry", "Exhausted", "Restrained", "Dazed", "Scared", "Weakened"];

Hooks.on("preCreateActor", (actor, data) => {
  if (actor.type !== "character" || data.items?.length) return;
  actor.updateSource({
    items: DEFAULT_CONDITIONS.map((key) => ({
      name: game.i18n.localize(`NCO.Condition.${key}`),
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

// World collections don't exist until ready, and only one client should
// create the convenience macro (and only if it doesn't exist yet).
// Show the Pressure display (if the optional rule is enabled) once the UI exists.
Hooks.once("ready", function () {
  PressureApp.refresh();
});

Hooks.once("ready", function () {
  if (!game.user.isGM || game.macros.getName("NCO Roll")) return;
  Macro.create({
    name: "NCO Roll",
    type: "script",
    command: "game.nco.NCORollDialog.open();",
    img: "icons/dice/d6.webp",
  }).catch((e) => console.warn("NCO | Macro creation failed:", e));
});

// Add a "NCO Roll" tool to the token controls so the GM and players alike
// always have one-click access to the global roll dialog from the canvas.
Hooks.on("getSceneControlButtons", (controls) => {
  const tool = {
    name: "nco-roll",
    order: 99,
    title: "NCO.RollDialog.OpenTool",
    icon: "fas fa-dice-d6",
    button: true,
    onChange: () => NCORollDialog.open(),
    onClick: () => NCORollDialog.open(),
  };

  try {
    if (Array.isArray(controls)) {
      // Foundry v12: controls is an array of { name, tools: [...] }
      const tokenControls = controls.find((c) => c.name === "token" || c.name === "tokens");
      tokenControls?.tools?.push(tool);
    } else {
      // Foundry v13+: controls is a record keyed by control name, tools is a record too
      const tokenControls = controls.tokens ?? controls.token;
      if (tokenControls) {
        tokenControls.tools ??= {};
        tokenControls.tools[tool.name] = tool;
      }
    }
  } catch (e) {
    console.warn("NCO | Failed to add scene control button:", e);
  }
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
