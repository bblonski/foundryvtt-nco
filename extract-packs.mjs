/**
 * The reverse of build-packs.mjs: dump the compiled compendium databases
 * (packs/<pack>/) back into the committed source JSON (packs/_source/<pack>/).
 * Run this after editing pack content inside a Foundry world and exporting it
 * to the system compendium (unlock it, then "Export to Compendium" with
 * "Merge by Name"), so the world edits land in version control.
 *
 * Run with Foundry closed — it locks the pack databases while running.
 *
 * Files are named from the document name ("Getting Started" →
 * getting-started.json), matching the curated sources, and existing files are
 * overwritten in place. A document renamed inside Foundry therefore extracts
 * to a NEW file: delete the stale one, or the next build:packs resurrects it.
 * Review the git diff before committing — scrub() strips the known noise a
 * world export drags in, but new Foundry versions may introduce more, and
 * per-user ownership entries or stray flags should be caught by eye.
 *
 * Usage: npm run extract:packs
 */
import { extractPack } from "@foundryvtt/foundryvtt-cli";

const PACKS = ["macros", "guides"];

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Strip the boilerplate a world export adds but the curated sources omit:
 * `_stats` audit blocks, empty/null optional fields, and default sub-objects
 * (a journal page's video settings). Everything meaningful — content, names,
 * ids, `_key`s, non-default ownership — passes through untouched. Recurses
 * into embedded collections (e.g. a journal's pages).
 */
function scrub(doc) {
  delete doc._stats;
  for (const key of ["author", "src", "category"]) {
    if (doc[key] === null) delete doc[key];
  }
  for (const key of ["system", "image", "categories"]) {
    const value = doc[key];
    if (value && typeof value === "object" && !Object.keys(value).length) delete doc[key];
  }
  if (doc.video?.controls === true && doc.video?.volume === 0.5 && Object.keys(doc.video).length === 2) {
    delete doc.video;
  }
  for (const value of Object.values(doc)) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (entry && typeof entry === "object" && "_id" in entry) scrub(entry);
    }
  }
}

for (const pack of PACKS) {
  await extractPack(`packs/${pack}`, `packs/_source/${pack}`, {
    log: true,
    transformEntry: scrub,
    transformName: (doc) => `${slug(doc.name) || doc._id}.json`,
  });
  console.log(`Extracted packs/${pack}`);
}
