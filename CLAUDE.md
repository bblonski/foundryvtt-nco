We're creating a rules system for FoundryVTT v14 for the Neon City Overdrive RPG.
The plan is to support other related systems like Star Scoundrels and Dungeon Crawlers, so Neon City Overdrive specific elements and themes should be configurable.

References:
https://foundryvtt.com/api/
https://foundryvtt.com/article/system-development/

Foundryvtt install at /home/bblonski/Desktop/FoundryVTT-Linux-14.363/

## Architecture

System id `foundryvtt-nco`. Vanilla ES modules (no build step) loaded directly by Foundry; `system.json` declares `scripts/nco.js` as the single esmodule, plus the `styles/`, `languages/`, and `templates/` assets. Hot reload is enabled for css/hbs/json. Targets the Application/Sheet **V2** APIs and DataModel-based document types throughout.

### Entry point — `scripts/nco.js`
Registers everything on the Foundry `init` hook: data models (`CONFIG.Actor/Item.dataModels`), V2 sheets, and all world settings. Also wires the other lifecycle behavior:
- `i18nInit` — applies the active game line's theme + terminology before any sheet renders (see Game lines).
- `preCreateActor` — seeds new characters with the six default Conditions.
- `preCreateItem` — applies per-type default icons.
- `chatMessage` — parses the `/r a4d6` chat command into an `NCORoll`.
- `getSceneControlButtons` / `ready` — adds the global roll tool button and "NCO Roll" macro.

### Document types
**Actors:** `character`, `threat`, `vehicle`. **Items:** `condition`, `trademark`, `gear`, `scene`, `job`. Scenes and Jobs are deliberately Items (not Actors) — they have no token/canvas presence and live in folders/compendia. Each type has a data model in `scripts/data/<type>-data.js` (extends `foundry.abstract.TypeDataModel`, `defineSchema()`, optional `prepareDerivedData()`) and a sheet in `scripts/sheets/<type>-sheet.js` with a Handlebars template in `templates/{actor,item}/`.

### Sheets — `scripts/sheets/nco-sheet-mixin.js`
`NCOSheetMixin(Base)` is the shared sheet behavior, applied as a mixin (not a base class) because sheets sit on top of two different Foundry bases — `ActorSheetV2` and `ItemSheetV2`. It applies `HandlebarsApplicationMixin` itself and works against `this.document` so it stays class-agnostic. Provides: the play/edit lock toggle, portrait file picker, Tag click-to-invoke + Tag CRUD on `system.tags`, and damage-track click/right-click handling driven by an overridable `_trackConfig(track)`. Per-type sheets override only what's unique (e.g. the Character sheet maps several tracks; the Job sheet drives foreign linked-Threat tracks).

### Dice — `scripts/dice/nco-roll.js`
`NCORoll` encapsulates one Action-Tales check: roll N Action d6 and M Danger d6, each Danger die cancels one matching-value Action die, highest surviving Action die is the result (6 = success, +1 boon per extra 6; 4-5 = partial; botch when all cancelled or only 1s remain). Renders its own inline-styled chat card (themeable via CSS custom properties), integrates dice-so-nice, and can tick the Pressure track. `NCORollDialog` (`scripts/applications/`) is the interactive shared-pool dialog; `NCORoll.fromDialog()` is a simpler direct-count prompt for macros.

### Shared roll pool & tags
`Tags` (`scripts/tags.js`) is the single invocation path: a **positive** Tag (Trademark/Edge) adds an Action die, a **negative** Tag (Flaw/Trauma/Condition) adds a Danger die; shift-click inverts polarity. Clicking a Tag on any sheet pushes dice into `GlobalRollPool` (`scripts/global-roll-pool.js`) — a **world-scoped setting** so the pool is shared and identical for every client. Because only GMs can write world settings, player mutations are relayed over the `system.foundryvtt-nco` socket and applied by the active GM; the broadcast setting change re-renders/opens every client's roll dialog via `onChange`. Applies are serialized through a promise queue and batched (`addMany`) to avoid read-modify-write races.

### Pressure track — `scripts/pressure-track.js` + `applications/pressure-app.js`
Optional GM resource track shown to all players. Same world-setting + GM-socket-relay pattern as the roll pool; it tags its socket messages with `channel: "pressure"` to share the single `system.<id>` socket channel with the roll pool.

### Game lines (theming + terminology) — `scripts/config.js`
One rules engine, multiple settings/game lines (`nco`, `star-scoundrels`, `dungeon-crawlers`, `hard-city`, `tomorrow-city`). A world's `gameLine` setting picks one; `applyGameLineTerms()` merges that line's terminology overrides onto the loaded i18n strings and a `nco-theme-*` body class selects the palette (token overrides in `styles/themes.css`). **This is the configurability mechanism** the project goal calls for: NCO-specific names/themes live in the per-line `terms` maps, keyed by the i18n keys in `languages/en.json`, while the shared Action-Tales vocabulary stays in the base strings. To rename a concept for a line, add `"<i18n key>": "<text>"` pairs to its `terms` map.

### Conventions
- All user-facing text is i18n keys (`NCO.*`) in `languages/en.json`; never hardcode strings.
- Chat-card / sheet-generated HTML uses CSS custom properties (`--nco-action`, `--nco-danger`, etc.) so themes restyle without code changes; escape interpolated text with `escapeHTML` from `scripts/lib/lib.js`.
- New world settings are registered in `nco.js`; mark `requiresReload: true` when the change re-skins or re-lays-out sheets.
