![Foundry v14](https://img.shields.io/badge/Foundry-v14-informational)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

# Neon City Overdrive and other Action Tales!

An unofficial [FoundryVTT](https://foundryvtt.com/) game system implementing
**Neon City Overdrive** and the other *Action Tales!* games by
[Peril Planet](https://perilplanet.com/).

The system primarily focuses on **Neon City Overdrive**, is configurable to support 
other Action Tales! games such as **Star Scoundrels** and **Dungeon Crawlers**.

## User Guide

### Making Characters

Click the lock icon at the top right of a sheet to toggle edit mode.
Adjust Trademarks, Hits, Stunt Points, and more in edit mode, the lock the sheet to play.

### Rolling: click Tags to build a dice pool

This system uses a global dice pool that any player can add Tags to.
You build that pool by **clicking the Tags on your sheet**:

- A character sheet in **play mode** shows your
  Trademarks, Edges, Flaws, Traumas, Conditions, and Gear Tags as clickable
  chips.
- **Click a positive Tag** (a Trademark name or an Edge) to add an **Action**
  die. **Click a negative Tag** (a Flaw, Trauma, or Condition) to add a
  **Danger** die.
- **Shift-click** any Tag to invert it — a positive Tag becomes a Danger die and
  vice versa.
- Clicking a Tag drops it into the **shared roll pool**. The GM can add Tags and
  Danger Rating from threats while Players build their dice pools. Click roll on
  the global dice pool to roll dice and get your result.

### Building Trademarks

Build Trademarks and Gear as items to easily drag and drop them on the character sheet.
Edit Trademarks to upgrade Triggers/Traits into Edges. 
Custom Trademarks and Gear can also be created directly from the character sheet.

### Enabling the Pressure track

Pressure is an optional rule from Star Scoundrels which can be enabled from the system settings.

Once enabled, the track appears for all players at the top of the scene. 
Each uncancelled **6 on a Danger die** automatically ticks Pressure up by +1.

### On the character sheet

- **Hits, Stunt Points, XP, Stash** are click tracks — left-click to
  fill, right-click to clear. You can change click behavior to direct
  fill to clicked point in the system settings.
- **The Drive Track** uses 3 state checkboxes that can be Ticked or Crossed.
- **Click the Stunt Label** to post Stunt point usage to chat and reduce current stunt points by 1.
- Adding a new **Trauma** automatically rolls a death check.

## Installation

### From within Foundry VTT (recommended)

1. Open Foundry VTT and go to the **Game Systems** tab on the Setup screen.
2. Click **Install System**.
3. Paste the following manifest URL into the **Manifest URL** field:

   ```
   https://github.com/bblonski/foundryvtt-nco/releases/latest/download/system.json
   ```

4. Click **Install**. Foundry will always pull the latest released version from
   this URL.

### Manual installation

1. Download `system.zip` from the
   [latest release](https://github.com/bblonski/foundryvtt-nco/releases/latest).
2. Extract it into your Foundry `Data/systems/` directory so that the files live
   in a `foundryvtt-nco/` folder (i.e. `Data/systems/foundryvtt-nco/system.json`).
3. Restart Foundry VTT. The system will appear in the **Game Systems** list.

**Compatibility:** Foundry VTT v12 minimum, verified on v14.

## Developers

### Release process

Releases are automated by the GitHub Action in
[`.github/workflows/main.yml`](.github/workflows/main.yml), which runs whenever a
GitHub Release is **published**.

The manifest tracks release-specific values with replacement tokens
(`#{VERSION}#`, `#{URL}#`, `#{MANIFEST}#`, `#{DOWNLOAD}#`) that are filled in at
release time — **do not** commit literal values in their place.

To cut a release:

1. Create a new Git tag / GitHub Release using a version in the form
   `v<major>.<minor>.<patch>` or `<major>.<minor>.<patch>` (e.g. `v1.2.3`).
   The tag's version drives the `version` field in the released manifest.
2. **Publish** the release.
3. The workflow will:
   - extract the version from the tag,
   - substitute the manifest tokens with the version and release URLs,
   - package `system.json`, `README.md`, `LICENSE`, and the
     `templates/`, `scripts/`, `styles/`, `packs/`, and language directories
     into `system.zip`,
   - attach `system.json` and `system.zip` to the GitHub Release.

The "latest" manifest URL
(`.../releases/latest/download/system.json`) always points at the most recent
published release, which is the URL used for in-Foundry installs and updates.

### Listing a new version on Foundry's package admin

For releases to be offered to users who installed via Foundry's package
directory, update the system's entry on the
[Foundry package admin](https://foundryvtt.com/admin/packages/package/). When
adding a version, use the manifest URL **for that specific version** (not the
`/latest/` URL). See the
[releases and history guide](https://foundryvtt.wiki/en/development/guides/releases-and-history)
for why the version-specific manifest matters.

## License

Released under the [MIT License](LICENSE). Neon City Overdrive and the *Action
Tales!* games are the property of Peril Planet; this is an unofficial, fan-made implementation.
