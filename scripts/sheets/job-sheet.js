import { Tags, TAG_POLARITY } from "../tags.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Job actor sheet for Neon City Overdrive.
 *
 * A Job is the planning hub for a mission: freeform Concept/Objective/Obstacles/
 * Link text, plus two lists of related Actors — Scenes and Threats. Scene and
 * Threat Actors are added by dragging them onto the sheet; they are stored by
 * UUID and rendered inline so their Tags (and a Threat's Danger Rating) can be
 * invoked directly from the Job, exactly as they would be on the source sheet.
 *
 * Like the other tag-bearing sheets it has an edit mode (text inputs and remove
 * controls) and a play mode (enriched text and clickable chips).
 */
export class JobSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "actor"],
    position: { width: 560, height: 680, top: 80 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage: this._onEditImage,
      toggleEdit: this._onToggleEdit,
      invoke: this._onInvoke,
      invokeDanger: this._onInvokeDanger,
      trackHits: this._onTrackHits,
      openActor: this._onOpenActor,
      removeScene: this._onRemoveScene,
      removeThreat: this._onRemoveThreat,
    },
  };

  static PARTS = {
    // Preserve the body's scroll position across re-renders (e.g. when a linked
    // Threat's Hits change and the updateActor hook re-renders the sheet).
    sheet: {
      template: "systems/foundryvtt-nco/templates/actor/job-sheet.hbs",
      scrollable: [".nco-sheet-body"],
    },
  };

  /** Bound once so the drop listener can be de-duplicated across renders. */
  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = (event) => event.preventDefault();

  /** Bound once so the related-Actor hooks can be unregistered on close. */
  #onRelatedChangeBound = (actor) => this.#onRelatedChange(actor);

  /** Whether the related-Actor hooks are currently registered. */
  #relatedHooksActive = false;

  /**
   * Re-render whenever a linked Scene/Threat is edited or deleted so its inline
   * display (Tags, Danger Rating, etc.) stays in sync with the source.
   *
   * Registered on render rather than in the constructor: Foundry caches the
   * sheet instance across close/reopen (it does not re-run the constructor), so
   * constructor-time registration would be lost for good once `_onClose`
   * removed it. Tying it to the render lifecycle keeps it correct across reopens.
   */
  #registerRelatedHooks() {
    if (this.#relatedHooksActive) return;
    Hooks.on("updateActor", this.#onRelatedChangeBound);
    Hooks.on("deleteActor", this.#onRelatedChangeBound);
    this.#relatedHooksActive = true;
  }

  #unregisterRelatedHooks() {
    if (!this.#relatedHooksActive) return;
    Hooks.off("updateActor", this.#onRelatedChangeBound);
    Hooks.off("deleteActor", this.#onRelatedChangeBound);
    this.#relatedHooksActive = false;
  }

  /** @override */
  _onClose(options) {
    this.#unregisterRelatedHooks();
    return super._onClose(options);
  }

  /** Re-render if the changed Actor is one of this Job's linked Scenes/Threats. */
  #onRelatedChange(actor) {
    if (!this.rendered || !actor?.uuid) return;
    const sys = this.actor.system;
    if ([...(sys.scenes ?? []), ...(sys.threats ?? [])].includes(actor.uuid)) {
      this.render();
    }
  }

  /** Show just the document name in the title bar, without the type prefix. */
  get title() {
    return this.document.name;
  }

  /** Whether this sheet is currently in edit mode. Starts editable for a blank Job. */
  _editing;

  get isEditing() {
    this._editing ??= !this.#hasContent();
    return this._editing && this.isEditable;
  }

  /** A Job has content once it has any related Actor or any text filled in. */
  #hasContent() {
    const sys = this.actor.system;
    return !!(
      sys.scenes?.length ||
      sys.threats?.length ||
      sys.concept?.trim() ||
      sys.objective?.trim() ||
      sys.obstacles?.trim() ||
      sys.link?.trim()
    );
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const TextEditorImpl = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;

    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      editing: this.isEditing,
      editable: this.isEditable,
      scenes: this.#resolveScenes(),
      threats: await this.#resolveThreats(TextEditorImpl),
      invokePositiveTitle: game.i18n.localize("NCO.Sheet.InvokePositive"),
      invokeNegativeTitle: game.i18n.localize("NCO.Sheet.InvokeNegative"),
      invokeDangerTitle: game.i18n.localize("NCO.Sheet.InvokeDangerRating"),
      trackHint: game.i18n.localize(
        game.settings.get("foundryvtt-nco", "trackClickMode") === "fill"
          ? "NCO.Sheet.TrackHintFill"
          : "NCO.Sheet.TrackHintIncrement",
      ),
    };
  }

  /** Resolve a list of stored Actor UUIDs, dropping any that no longer exist. */
  #resolveActors(uuids) {
    return (uuids ?? [])
      .map((uuid) => ({ uuid, actor: fromUuidSync(uuid) }))
      .filter((entry) => entry.actor);
  }

  /** Map an Actor's Tags to the clickable-chip view model shared by the templates. */
  #prepareTags(actor) {
    return (actor.system.tags ?? []).map((tag) => ({
      text: tag.text,
      positive: tag.polarity !== TAG_POLARITY.NEGATIVE,
      polarity: tag.polarity !== TAG_POLARITY.NEGATIVE ? TAG_POLARITY.POSITIVE : TAG_POLARITY.NEGATIVE,
      clickable: !!tag.text?.trim(),
    }));
  }

  /** Related Scenes: name, portrait, and clickable Tags. */
  #resolveScenes() {
    return this.#resolveActors(this.actor.system.scenes).map(({ uuid, actor }) => ({
      uuid,
      name: actor.name,
      img: actor.img,
      tags: this.#prepareTags(actor),
    }));
  }

  /** Related Threats: name, portrait, Danger Rating, Hits, Drive/Actions, and Tags. */
  async #resolveThreats(TextEditorImpl) {
    const threats = [];
    for (const { uuid, actor } of this.#resolveActors(this.actor.system.threats)) {
      const sys = actor.system;
      const max = sys.hits?.effectiveMax ?? Math.max(1, sys.hits?.max ?? 0);
      threats.push({
        uuid,
        name: actor.name,
        img: actor.img,
        dangerRating: sys.dangerRating ?? 0,
        boss: !!sys.boss,
        hits: { taken: sys.hits?.taken ?? 0, max },
        hitGroups: this.#prepareHitGroups(sys),
        tags: this.#prepareTags(actor),
        driveHTML: await TextEditorImpl.enrichHTML(sys.drive ?? "", { relativeTo: actor }),
        actionsHTML: await TextEditorImpl.enrichHTML(sys.actions ?? "", { relativeTo: actor }),
      });
    }
    return threats;
  }

  /** How many Hits boxes Boss Threats group together (matches the Threat sheet). */
  static HIT_GROUP_SIZE = 3;

  /**
   * A Threat's Hits track split into groups for the template. Bosses triple
   * their Hits and are grouped in threes (with a divider between groups); a
   * normal Threat is a single row. Boxes fill from the left.
   */
  #prepareHitGroups(sys) {
    const max = sys.hits?.effectiveMax ?? Math.max(1, sys.hits?.max ?? 0);
    const taken = Math.min(max, Math.max(0, sys.hits?.taken ?? 0));
    const groupSize = sys.boss ? JobSheet.HIT_GROUP_SIZE : max;
    const groups = [];
    for (let i = 0; i < max; i += groupSize) {
      groups.push(
        Array.from({ length: Math.min(groupSize, max - i) }, (_, j) => ({
          index: i + j,
          checked: i + j < taken,
        })),
      );
    }
    return groups;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    // Keep the linked Scene/Threat live-sync hooks tied to the render lifecycle
    // (idempotent), so they survive a close/reopen of the cached sheet instance.
    this.#registerRelatedHooks();
    // ApplicationV2 keeps the root element across renders, so de-dupe the drop
    // listeners (same bound reference) rather than stacking a new pair each time.
    const el = this.element;
    el.removeEventListener("dragover", this.#onDragOverBound);
    el.removeEventListener("drop", this.#onDropBound);
    if (this.isEditable) {
      el.addEventListener("dragover", this.#onDragOverBound);
      el.addEventListener("drop", this.#onDropBound);
    }
    // Right-click isn't an ActionV2 trigger, so wire each Threat's Hits track
    // contextmenu (decrement) manually. Tracks are rebuilt each render.
    for (const track of el.querySelectorAll(".nco-related-card .nco-track")) {
      track.addEventListener("contextmenu", this.#onTrackRemove.bind(this));
    }
  }

  /** Resolve the linked Threat Actor a Hits-track element belongs to. */
  #threatFromTrack(target) {
    const card = target.closest("[data-uuid]");
    return card ? fromUuidSync(card.dataset.uuid) : null;
  }

  /**
   * Left-click a linked Threat's Hits track. The world's "track click mode"
   * setting decides whether this adds a single box ("increment") or fills/clears
   * up to the clicked box ("fill"). Updates the Threat Actor directly.
   */
  static async _onTrackHits(event, target) {
    if (!this.isEditable) return;
    const threat = this.#threatFromTrack(target);
    if (!threat) return;
    const sys = threat.system;
    const max = sys.hits?.effectiveMax ?? Math.max(1, sys.hits?.max ?? 0);
    const current = sys.hits?.taken ?? 0;
    let next;
    if (game.settings.get("foundryvtt-nco", "trackClickMode") === "fill") {
      const box = event.target.closest("[data-index]");
      if (!box) return;
      const index = Number(box.dataset.index);
      // Clicking a filled box clears down to it; an empty box fills up to it.
      next = index < current ? index : index + 1;
    } else {
      next = current + 1;
    }
    next = Math.max(0, Math.min(max, next));
    if (next !== current) await threat.update({ "system.hits.taken": next });
  }

  /** Right-click a linked Threat's Hits track: clear the last box ("increment" mode only). */
  async #onTrackRemove(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    if (game.settings.get("foundryvtt-nco", "trackClickMode") !== "increment") return;
    const threat = this.#threatFromTrack(event.currentTarget);
    if (!threat) return;
    const current = threat.system.hits?.taken ?? 0;
    const next = Math.max(0, current - 1);
    if (next !== current) await threat.update({ "system.hits.taken": next });
  }

  /**
   * Accept a dragged Scene or Threat Actor and add it to the matching list.
   * Other Actor types (and non-Actor drops) are rejected with a notice.
   */
  async #onDrop(event) {
    event.preventDefault();
    const TextEditorImpl = foundry.applications.ux?.TextEditor?.implementation ?? TextEditor;
    let data;
    try {
      data = TextEditorImpl.getDragEventData(event);
    } catch {
      return;
    }
    if (data?.type !== "Actor" || !data.uuid) return;

    const actor = await fromUuid(data.uuid);
    if (!actor) return;
    const field = { scene: "scenes", threat: "threats" }[actor.type];
    if (!field) {
      ui.notifications?.warn(game.i18n.localize("NCO.Sheet.JobDropUnsupported"));
      return;
    }

    // Flush any pending text edit before the structural change so submitOnChange
    // can't clobber it (or vice versa).
    if (this.isEditable) await this.submit();
    const list = this.actor.toObject().system[field] ?? [];
    if (list.includes(actor.uuid)) return; // already linked
    list.push(actor.uuid);
    await this.actor.update({ [`system.${field}`]: list });
  }

  /**
   * Click a related Actor's Tag: add it to the shared roll pool, crediting the
   * source Actor. Positive Tags add an Action die, negative a Danger die;
   * shift-click inverts the polarity.
   */
  static async _onInvoke(event, target) {
    await Tags.invoke({
      text: target.dataset.text,
      polarity: target.dataset.polarity ?? TAG_POLARITY.POSITIVE,
      source: target.dataset.source ?? this.actor.name,
      invert: event.shiftKey,
    });
  }

  /** Click a related Threat's Danger Rating: add that many Danger dice. */
  static async _onInvokeDanger(event, target) {
    const rating = Number(target.dataset.rating) || 0;
    if (rating <= 0) return;
    await Tags.invoke({
      text: game.i18n.localize("NCO.Sheet.DangerRating"),
      polarity: TAG_POLARITY.NEGATIVE,
      source: target.dataset.source ?? this.actor.name,
      invert: event.shiftKey,
      count: rating,
    });
  }

  /** Open a related Actor's own sheet. */
  static async _onOpenActor(_event, target) {
    const actor = await fromUuid(target.dataset.uuid);
    actor?.sheet?.render(true);
  }

  /** Remove a stored UUID from one of the related-Actor lists. */
  async #removeFrom(field, uuid) {
    if (this.isEditable) await this.submit();
    const list = (this.actor.toObject().system[field] ?? []).filter((u) => u !== uuid);
    await this.actor.update({ [`system.${field}`]: list });
  }

  static async _onRemoveScene(_event, target) {
    await this.#removeFrom("scenes", target.dataset.uuid);
  }

  static async _onRemoveThreat(_event, target) {
    await this.#removeFrom("threats", target.dataset.uuid);
  }

  static _onToggleEdit(_event, _target) {
    this._editing = !this.isEditing;
    this.render();
  }

  /** Open a file picker for the Job portrait. */
  static async _onEditImage(_event, _target) {
    const FilePickerImpl = foundry.applications.apps?.FilePicker?.implementation ?? FilePicker;
    const picker = new FilePickerImpl({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path }),
    });
    return picker.browse();
  }
}
