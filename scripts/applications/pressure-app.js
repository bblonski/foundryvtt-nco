import { PressureTrack } from "../pressure-track.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The on-canvas Pressure display, pinned near the top-center of the screen and
 * visible to every connected player.
 *
 * Frameless (no title bar, not draggable) so it reads as a HUD element rather
 * than a window. The GM additionally gets a reset button. Re-rendered whenever
 * the Pressure value, track length, or enabled setting changes.
 */
export class PressureApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "nco-pressure-track",
    classes: ["nco", "nco-pressure-app"],
    window: { frame: false, positioned: true },
    position: { width: "auto", height: "auto" },
    actions: {
      reset: this._onReset,
      setLevel: this._onSetLevel,
    },
  };

  static PARTS = {
    content: { template: "systems/foundryvtt-nco/templates/pressure/pressure-track.hbs" },
  };

  /** @override */
  async _prepareContext(_options) {
    const max = PressureTrack.max;
    const value = PressureTrack.value;
    return {
      value,
      max,
      isGM: game.user.isGM,
      // One entry per box; true for the boxes that are currently filled.
      boxes: Array.from({ length: max }, (_, i) => i < value),
    };
  }

  /** GM-only: clear the track. */
  static _onReset(_event, _target) {
    return PressureTrack.reset();
  }

  /**
   * GM-only: click a box to set the level. Like the character sheet's "fill"
   * tracks, clicking a filled box clears down to it while clicking an empty box
   * fills up to it.
   */
  static _onSetLevel(_event, target) {
    if (!game.user.isGM) return;
    const index = Number(target.dataset.index);
    const next = index < PressureTrack.value ? index : index + 1;
    return PressureTrack.set(next);
  }

  /**
   * Open, close, or re-render the display to match the current settings.
   * Safe to call from any onChange handler or the ready hook.
   */
  static refresh() {
    const existing = foundry.applications.instances.get("nco-pressure-track");
    if (!PressureTrack.enabled) {
      existing?.close();
      return;
    }
    const app = existing instanceof PressureApp ? existing : new PressureApp();
    app.render({ force: true });
  }
}
