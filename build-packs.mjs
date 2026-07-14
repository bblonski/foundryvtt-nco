/**
 * Compile the compendium pack source JSON (packs/_source/<pack>/*.json) into
 * the LevelDB databases Foundry loads (packs/<pack>/). The compiled output is
 * committed, so this only needs to run after editing the source JSON — with
 * Foundry closed, since it locks the pack databases while a world is open.
 *
 * Usage: npm run build:packs
 */
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const PACKS = ["macros", "guides"];

for (const pack of PACKS) {
  await compilePack(`packs/_source/${pack}`, `packs/${pack}`);
  console.log(`Compiled packs/${pack}`);
}
