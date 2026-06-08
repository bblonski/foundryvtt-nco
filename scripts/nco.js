import { NCORoll } from "./dice/nco-roll.js";

// Matches: /r a4d5  or  /r a4  (danger count optional)
const NCO_CHAT_PATTERN = /^\/r\s+a(\d+)(?:d(\d+))?\s*$/i;

Hooks.once("init", function () {
  game.nco = { NCORoll };
  
  // Register the chat macro for NCORoll
  if (game.macros) {
    const macroData = {
      name: "NCORoll",
      type: "script",
      command: `
        game.nco.NCORoll.fromDialog().then(roll => {
          if (roll) roll.toMessage();
        });
      `,
      scope: "global",
      img: "icons/dice/d6.webp"
    };
    
    // Try to create the macro
    try {
      game.macros.create(macroData);
    } catch (e) {
      console.log("Macro creation failed:", e.message);
    }
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
