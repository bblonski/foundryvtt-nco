import { NCORoll } from "./dice/nco-roll.js";
import { CharacterData } from "./data/character-data.js";
import { ThreatData } from "./data/threat-data.js";
import { VehicleData } from "./data/vehicle-data.js";
import { ConditionData } from "./data/condition-data.js";
import { TrademarkData } from "./data/trademark-data.js";
import { GearData } from "./data/gear-data.js";
import { CharacterSheet } from "./sheets/character-sheet.js";
import { ThreatSheet } from "./sheets/threat-sheet.js";
import { VehicleSheet } from "./sheets/vehicle-sheet.js";
import { TrademarkSheet } from "./sheets/trademark-sheet.js";
import { GearSheet } from "./sheets/gear-sheet.js";
import { ConditionSheet } from "./sheets/condition-sheet.js";
import { NCORollDialog } from "./applications/nco-roll-dialog.js";
import { GlobalRollPool } from "./global-roll-pool.js";
import { PressureTrack } from "./pressure-track.js";
import { PressureApp } from "./applications/pressure-app.js";
import { Tags } from "./tags.js";

// Matches: /r a4d5  or  /r a4  (danger count optional)
const NCO_CHAT_PATTERN = /^\/r\s+a(\d+)(?:d(\d+))?\s*$/i;

Hooks.once("init", function () {
  game.nco = { NCORoll, NCORollDialog, GlobalRollPool, PressureTrack, Tags };

  CONFIG.Actor.dataModels.character = CharacterData;
  CONFIG.Actor.dataModels.threat = ThreatData;
  CONFIG.Actor.dataModels.vehicle = VehicleData;
  CONFIG.Item.dataModels.condition = ConditionData;
  CONFIG.Item.dataModels.trademark = TrademarkData;
  CONFIG.Item.dataModels.gear = GearData;

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

  game.settings.register("foundryvtt-nco", "maxHits", {
    name: "NCO.Settings.MaxHits.Name",
    hint: "NCO.Settings.MaxHits.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 1, max: 6, step: 1 },
    default: 4,
  });

  game.settings.register("foundryvtt-nco", "xpTrackLength", {
    name: "NCO.Settings.XPTrackLength.Name",
    hint: "NCO.Settings.XPTrackLength.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 5, max: 20, step: 1 },
    default: 15,
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
  });

  // Whether the optional Stash track appears on character sheets.
  game.settings.register("foundryvtt-nco", "stashTrackEnabled", {
    name: "NCO.Settings.StashTrack.Name",
    hint: "NCO.Settings.StashTrack.Hint",
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
