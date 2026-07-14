import { NCOSheetMixin } from "./nco-sheet-mixin.js";
import { Tags, TAG_POLARITY } from "../tags.js";

const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Job sheet for Neon City Overdrive.
 *
 * A Job is the planning hub for a mission: freeform Concept/Objective/Obstacles/
 * Link text, plus two lists of related documents — Scenes (Items) and Threats
 * (Actors). They are added by dragging them onto the sheet, stored by UUID, and
 * rendered inline so their Tags (and a Threat's Danger Rating and Hits) can be
 * driven directly from the Job, exactly as on the source sheet.
 *
 * A Job is itself an Item (not an Actor) so it can be foldered alongside Scenes
 * and shipped in compendia. Shared sheet behavior (title, edit toggle, portrait,
 * Tag invocation) comes from {@link NCOSheetMixin}.
 */
export class JobSheet extends NCOSheetMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["nco", "sheet", "item"],
    position: { width: 560, height: 680, top: 80 },
    actions: {
      openActor: this._onOpenActor,
      trackHits: this._onTrackHits,
      removeScene: this._onRemoveScene,
      removeThreat: this._onRemoveThreat,
      // Re-registered: the mixin's action map captured its own _onInvokeDanger
      // function reference, so overriding the static method alone is not enough.
      invokeDanger: this._onInvokeDanger,
    },
  };

  static PARTS = {
    // Preserve the body's scroll position across re-renders (e.g. when a linked
    // Threat's Hits change and the updateActor hook re-renders the sheet).
    sheet: {
      template: "systems/foundryvtt-nco/templates/item/job-sheet.hbs",
      scrollable: [".nco-sheet-body"],
    },
  };

  /** How many Hits boxes Boss Threats group together (matches the Threat sheet). */
  static HIT_GROUP_SIZE = 3;

  /** Bound once so the drop listener can be de-duplicated across renders. */
  #onDropBound = this.#onDrop.bind(this);
  #onDragOverBound = (event) => event.preventDefault();

  /** Bound once so the related-document hooks can be registered/unregistered. */
  #onRelatedChangeBound = (doc) => this.#onRelatedChange(doc);

  /** Whether the related-document hooks are currently registered. */
  #relatedHooksActive = false;

  /**
   * Re-render whenever a linked Scene/Threat is edited or deleted so its inline
   * display (Tags, Danger Rating, etc.) stays in sync with the source. Scenes
   * are Items and Threats are Actors, so both document classes are watched.
   *
   * Registered on render rather than in the constructor: Foundry caches the
   * sheet instance across close/reopen (it does not re-run the constructor), so
   * constructor-time registration would be lost for good once `_onClose`
   * removed it. Tying it to the render lifecycle keeps it correct across reopens.
   */
  #registerRelatedHooks() {
    if (this.#relatedHooksActive) return;
    for (const hook of ["updateActor", "deleteActor", "updateItem", "deleteItem"]) {
      Hooks.on(hook, this.#onRelatedChangeBound);
    }
    this.#relatedHooksActive = true;
  }

  #unregisterRelatedHooks() {
    if (!this.#relatedHooksActive) return;
    for (const hook of ["updateActor", "deleteActor", "updateItem", "deleteItem"]) {
      Hooks.off(hook, this.#onRelatedChangeBound);
    }
    this.#relatedHooksActive = false;
  }

  /** @override */
  _onClose(options) {
    this.#unregisterRelatedHooks();
    return super._onClose(options);
  }

  /** Re-render if the changed document is one of this Job's linked Scenes/Threats. */
  #onRelatedChange(doc) {
    if (!this.rendered || !doc?.uuid) return;
    const sys = this.document.system;
    if ([...(sys.scenes ?? []), ...(sys.threats ?? [])].includes(doc.uuid)) {
      this.render();
    }
  }

  /** @override Start a blank Job in edit mode so there's something to fill in. */
  _startsBlank() {
    return !this.#hasContent();
  }

  /** A Job has content once it has any related document or any text filled in. */
  #hasContent() {
    const sys = this.document.system;
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
      ...this._baseContext(),
      scenes: this.#resolveScenes(),
      threats: await this.#resolveThreats(TextEditorImpl),
    };
  }

  /** Resolve a list of stored document UUIDs, dropping any that no longer exist. */
  #resolveLinked(uuids) {
    return (uuids ?? [])
      .map((uuid) => ({ uuid, doc: fromUuidSync(uuid) }))
      .filter((entry) => entry.doc);
  }

  /** Related Scenes: name, portrait, and clickable Tags. */
  #resolveScenes() {
    return this.#resolveLinked(this.document.system.scenes).map(({ uuid, doc }) => ({
      uuid,
      name: doc.name,
      img: doc.img,
      tags: this._prepareTags(doc.system.tags),
    }));
  }

  /** Related Threats: name, portrait, Danger Rating, Hits, Drive/Actions, and Tags. */
  async #resolveThreats(TextEditorImpl) {
    const threats = [];
    for (const { uuid, doc } of this.#resolveLinked(this.document.system.threats)) {
      const sys = doc.system;
      const max = sys.hits?.effectiveMax ?? Math.max(1, sys.hits?.max ?? 0);
      threats.push({
        uuid,
        name: doc.name,
        img: doc.img,
        dangerRating: sys.dangerRating ?? 0,
        boss: !!sys.boss,
        hits: { taken: sys.hits?.taken ?? 0, max },
        hitGroups: this.#prepareHitGroups(sys),
        tags: this._prepareTags(sys.tags),
        driveHTML: await TextEditorImpl.enrichHTML(sys.drive ?? "", { relativeTo: doc }),
        actionsHTML: await TextEditorImpl.enrichHTML(sys.actions ?? "", { relativeTo: doc }),
      });
    }
    return threats;
  }

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
  }

  /**
   * @override The Job's `.nco-track` elements belong to linked Threats, not to
   * the Job itself, so wire their right-click decrement to the linked-Threat
   * handler rather than the mixin's own-document one.
   */
  _bindTrackContextMenu() {
    for (const track of this.element.querySelectorAll(".nco-related-card .nco-track")) {
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
   * Accept a dragged Scene (Item) or Threat (Actor) and add it to the matching
   * list. Other document types (and non-document drops) are rejected with a notice.
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
    if ((data?.type !== "Actor" && data?.type !== "Item") || !data.uuid) return;

    const doc = await fromUuid(data.uuid);
    if (!doc) return;
    const field = { scene: "scenes", threat: "threats" }[doc.type];
    if (!field) {
      ui.notifications?.warn(game.i18n.localize("NCO.Sheet.JobDropUnsupported"));
      return;
    }

    // Flush any pending text edit before the structural change so submitOnChange
    // can't clobber it (or vice versa).
    if (this.isEditable) await this.submit();
    const list = this.document.toObject().system[field] ?? [];
    if (list.includes(doc.uuid)) return; // already linked
    list.push(doc.uuid);
    await this.document.update({ [`system.${field}`]: list });
  }

  /**
   * @override Click a related document's Danger Rating: add that many Danger
   * dice. The rating and crediting source come from the clicked chip, since a
   * Job draws several Threats' ratings rather than its own.
   */
  static async _onInvokeDanger(event, target) {
    const rating = Number(target.dataset.rating) || 0;
    if (rating <= 0) return;
    await Tags.invoke({
      text: game.i18n.localize("NCO.Sheet.DangerRating"),
      polarity: TAG_POLARITY.NEGATIVE,
      source: target.dataset.source ?? this.document.name,
      invert: event.shiftKey,
      count: rating,
    });
  }

  /** Open a related document's own sheet. */
  static async _onOpenActor(_event, target) {
    const doc = await fromUuid(target.dataset.uuid);
    doc?.sheet?.render(true);
  }

  /** Remove a stored UUID from one of the related-document lists. */
  async #removeFrom(field, uuid) {
    if (this.isEditable) await this.submit();
    const list = (this.document.toObject().system[field] ?? []).filter((u) => u !== uuid);
    await this.document.update({ [`system.${field}`]: list });
  }

  static async _onRemoveScene(_event, target) {
    await this.#removeFrom("scenes", target.dataset.uuid);
  }

  static async _onRemoveThreat(_event, target) {
    await this.#removeFrom("threats", target.dataset.uuid);
  }
}
