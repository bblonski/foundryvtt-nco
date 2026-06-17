import { PressureTrack } from "../pressure-track.js";
import { escapeHTML } from "../lib/lib.js";

const ACTION_COLOR = "#23d5e5";
const DANGER_COLOR = "#ff2e88";

/**
 * Encapsulates a Neon City Overdrive dice check:
 *   - Roll actionCount d6s and dangerCount d6s separately.
 *   - Each danger die cancels one matching-value action die.
 *   - The highest surviving action die is the result.
 *   - BOTCH when all action dice are cancelled or only 1s survive.
 */
export class NCORoll {
  /**
   * @param {number} actionCount
   * @param {number} dangerCount
   * @param {object} [options]
   * @param {{action?: string[], danger?: string[]}} [options.edges]
   *   Narrative tag text for any Edges that were invoked to build this roll,
   *   shown on the chat card alongside the dice.
   */
  constructor(actionCount, dangerCount, { edges = null } = {}) {
    this.actionCount = Math.max(1, actionCount);
    this.dangerCount = Math.max(0, dangerCount);
    this.edges = edges;

    this._actionRoll = new Roll(`${this.actionCount}d6`);
    this._dangerRoll = this.dangerCount > 0 ? new Roll(`${this.dangerCount}d6`) : null;

    // Populated after evaluate()
    this.actionDice = null;  // [{value, cancelled}]
    this.dangerDice = null;  // [{value, used}]
    this.remaining = null;   // [number]
    this.high = null;
    this.boons = 0;
    this.isBotch = false;
    this.evaluated = false;
  }

  /** All Roll instances, for attaching to a ChatMessage. */
  get rolls() {
    return this._dangerRoll ? [this._actionRoll, this._dangerRoll] : [this._actionRoll];
  }

  get resultLabel() {
    if (this.isBotch) return "BOTCH — Critical Failure";
    if (this.high === 6) return this.boons > 0 ? `Success — ${this.boons} Boon${this.boons > 1 ? "s" : ""}` : "Success";
    if (this.high >= 4) return "Partial Success — at a cost";
    return "Failure";
  }

  get resultColor() {
    if (this.isBotch) return DANGER_COLOR;
    if (this.high === 6) return ACTION_COLOR;
    if (this.high >= 4) return "#ffd23f";
    return "#ff8c42";
  }

  async evaluate() {
    await this._actionRoll.evaluate();
    if (this._dangerRoll) await this._dangerRoll.evaluate();
    this._resolve();
    this.evaluated = true;
    return this;
  }

  _resolve() {
    const actionValues = this._actionRoll.dice[0].results.map(r => r.result);
    const dangerValues = this._dangerRoll ? this._dangerRoll.dice[0].results.map(r => r.result) : [];

    this.actionDice = actionValues.map(v => ({ value: v, cancelled: false }));
    this.dangerDice = dangerValues.map(v => ({ value: v, used: false }));

    for (const d of this.dangerDice) {
      const target = this.actionDice.find(a => !a.cancelled && a.value === d.value);
      if (target) { target.cancelled = true; d.used = true; }
    }

    this.remaining = this.actionDice.filter(a => !a.cancelled).map(a => a.value);

    if (this.remaining.length === 0 || this.remaining.every(v => v === 1)) {
      this.isBotch = true;
      this.high = null;
    } else {
      this.high = Math.max(...this.remaining);
      this.boons = this.remaining.filter(v => v === 6).length - 1;
    }
  }

  /** Returns the HTML string for the chat card. */
  render() {
    if (!this.evaluated) throw new Error("NCORoll must be evaluated before rendering.");

    const pip = (v, { cancelled = false, faded = false, danger = false, hi = false } = {}) => {
      const color = danger ? DANGER_COLOR : ACTION_COLOR;
      const styles = [
        "display:inline-block", "width:26px", "height:26px", "line-height:26px",
        "text-align:center", "margin:2px", `border:1px solid ${color}`,
        "border-radius:4px", `color:${color}`, "font-weight:bold",
      ];
      const glow = danger ? DANGER_COLOR : this.resultColor;
      if (cancelled) styles.push("text-decoration:line-through", "opacity:0.35");
      else if (faded) styles.push("opacity:0.4");
      if (hi) styles.push(`box-shadow:0 0 6px 2px ${glow}`, `border-color:${glow}`);
      return `<span style="${styles.join(";")}">${v}</span>`;
    };

    let highlighted = false;
    const actionHtml = this.actionDice.map(a => {
      const markHi = !a.cancelled && this.high !== null && a.value === this.high && !highlighted;
      if (markHi) highlighted = true;
      return pip(a.value, { cancelled: a.cancelled, hi: markHi });
    }).join("");

    // Unused Danger dice (those that matched no Action die) are faded. With the
    // optional Pressure rule on, an uncancelled 6 is what ticks Pressure, so
    // glow it like the result die instead of fading it.
    const pressureOn = PressureTrack.enabled;
    const dangerHtml = this.dangerDice.map(d => {
      const ticksPressure = pressureOn && !d.used && d.value === 6;
      return pip(d.value, { danger: true, faded: !d.used && !ticksPressure, hi: ticksPressure });
    }).join("");

    const edgeLine = (color, label, texts) => texts?.length
      ? `<div style="color:${color};">${label}: ${texts.map(escapeHTML).join(", ")}</div>`
      : "";
    const edgesHtml = this.edges
      ? `<div style="margin:6px 0 2px;font-size:11px;line-height:1.5;">
          ${edgeLine(ACTION_COLOR, "Action Edges", this.edges.action)}
          ${edgeLine(DANGER_COLOR, "Danger Edges", this.edges.danger)}
        </div>`
      : "";

    return `
      <div style="border:1px solid ${ACTION_COLOR};border-radius:6px;padding:8px 10px;background:rgba(10,12,24,0.55);">
        <div style="font-family:'Courier New',monospace;letter-spacing:1px;color:${ACTION_COLOR};font-size:11px;text-transform:uppercase;">
          Neon City Overdrive · Check
        </div>
        ${edgesHtml}
        <div style="margin:6px 0 2px;color:${ACTION_COLOR};font-size:11px;">Action (${this.actionCount})</div>
        <div>${actionHtml}</div>
        ${this.dangerCount > 0
          ? `<div style="margin:6px 0 2px;color:${DANGER_COLOR};font-size:11px;">Danger (${this.dangerCount})</div><div>${dangerHtml}</div>`
          : ""}
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);
          font-size:16px;font-weight:bold;color:${this.resultColor};text-align:center;">
          ${this.high !== null ? `[${this.high}] ` : ""}${this.resultLabel}
        </div>
      </div>`;
  }

  /**
   * Evaluates the roll (if needed), plays DSN animation, and posts a chat message.
   * @param {object} messageData  Extra data merged into ChatMessage.create()
   */
  async toMessage(messageData = {}) {
    if (!this.evaluated) await this.evaluate();

    // Optional "Pressure" rule: each uncancelled 6 on a Danger die (one that
    // matched no Action die) ticks the GM's Pressure track up by one.
    if (PressureTrack.enabled && this.dangerDice) {
      const sixes = this.dangerDice.filter((d) => !d.used && d.value === 6).length;
      if (sixes > 0) PressureTrack.add(sixes);
    }

    const dsn = game.modules.get("dice-so-nice")?.active;
    if (dsn) {
      await game.dice3d.showForRoll(this._actionRoll, game.user, true);
      if (this._dangerRoll) await game.dice3d.showForRoll(this._dangerRoll, game.user, true);
    }

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker(),
      content: this.render(),
      rolls: this.rolls,
      sound: dsn ? null : CONFIG.sounds.dice,
      ...messageData,
    });
  }

  /**
   * Opens a DialogV2 prompt for a direct count of Action and Danger dice — a
   * simple entry point for macros, separate from the shared-pool NCORollDialog.
   *
   * @param {object}  [options]
   * @param {boolean} [options.post]  When true, evaluate the roll and post it to
   *   chat before returning, so a macro is a one-liner. When false (default),
   *   return the unevaluated NCORoll for the caller to drive.
   * @returns {Promise<NCORoll|null>} The roll, or null if the dialog was cancelled.
   */
  static async fromDialog({ post = false } = {}) {
    const actionLabel = game.i18n.localize("NCO.RollDialog.ActionDice");
    const dangerLabel = game.i18n.localize("NCO.RollDialog.DangerDice");
    const content = `
      <form style="display:flex;gap:12px;padding:6px 2px;">
        <div style="flex:1;">
          <label style="display:block;font-weight:bold;color:${ACTION_COLOR};">${actionLabel}</label>
          <input type="number" name="action" value="1" min="1" max="30" step="1" style="width:100%;"/>
        </div>
        <div style="flex:1;">
          <label style="display:block;font-weight:bold;color:${DANGER_COLOR};">${dangerLabel}</label>
          <input type="number" name="danger" value="0" min="0" max="30" step="1" style="width:100%;"/>
        </div>
      </form>`;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("NCO.RollDialog.Title") },
      content,
      ok: {
        icon: "fas fa-dice-d6",
        label: game.i18n.localize("NCO.RollDialog.Roll"),
        callback: (_event, _button, dialog) => {
          const form = dialog.element.querySelector("form");
          return new FormDataExtended(form).object;
        },
      },
    });

    if (!result) return null;
    const roll = new NCORoll(
      Math.max(1, parseInt(result.action) || 1),
      Math.max(0, parseInt(result.danger) || 0),
    );
    if (post) await roll.toMessage();
    return roll;
  }
}
