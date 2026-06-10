import { NCORoll } from "./dice/nco-roll.js";
import { CharacterData } from "./data/character-data.js";
import { CharacterSheet } from "./sheets/character-sheet.js";
import { NCORollDialog } from "./applications/nco-roll-dialog.js";
import { GlobalRollPool } from "./global-roll-pool.js";

// Matches: /r a4d5  or  /r a4  (danger count optional)
const NCO_CHAT_PATTERN = /^\/r\s+a(\d+)(?:d(\d+))?\s*$/i;

Hooks.once("init", function () {
  game.nco = { NCORoll, NCORollDialog, GlobalRollPool };

  CONFIG.Actor.dataModels.character = CharacterData;

  foundry.documents.collections.Actors.registerSheet("foundryvtt-nco", CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "NCO.Sheet.Character",
  });

  GlobalRollPool.registerSettings();
  GlobalRollPool.registerSocket();

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

// World collections don't exist until ready, and only one client should
// create the convenience macro (and only if it doesn't exist yet).
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
