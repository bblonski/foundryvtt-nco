import { Tags, TAG_POLARITY } from "../tags.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Behavior shared by every Neon City Overdrive document sheet, factored out so
 * the per-type sheets only carry what is genuinely unique to them.
 *
 * It is a mixin (rather than a base class) because the sheets sit on top of two
 * different Foundry bases: most are Actors, but Scenes and Jobs are Items. The
 * mixin works against `this.document` throughout so it is class-agnostic, and
 * applies `HandlebarsApplicationMixin` itself so callers wrap a plain
 * `ActorSheetV2`/`ItemSheetV2`:
 *
 *   class ThreatSheet extends NCOSheetMixin(ActorSheetV2) { ... }
 *   class SceneSheet  extends NCOSheetMixin(ItemSheetV2)  { ... }
 *
 * Provided here:
 *  - The play/edit lock toggle (`isEditing` + `toggleEdit`), with an overridable
 *    {@link _startsBlank} deciding whether a fresh document opens in edit mode.
 *  - The portrait file picker and the Tag-invocation click handler.
 *  - Tag CRUD for the `system.tags` array (add/remove/flip polarity), shared by
 *    the Threat, Vehicle and Scene sheets.
 *  - A single damage track's click/right-click handling, driven by an
 *    overridable {@link _trackConfig}. The Character sheet overrides it to map
 *    several tracks; the Job sheet overrides {@link _bindTrackContextMenu} to
 *    drive the foreign (linked-Threat) tracks it draws instead.
 *
 * @param {typeof foundry.applications.api.DocumentSheetV2} Base
 */
export function NCOSheetMixin(Base) {
  return class NCOSheet extends HandlebarsApplicationMixin(Base) {
    /** Polarity a newly created Tag starts at. Subclasses may override. */
    static NEW_TAG_POLARITY = TAG_POLARITY.POSITIVE;

    /**
     * Item sub-types this sheet accepts via drag & drop. Null keeps the base
     * class behavior (accept anything); an array rejects everything not in it
     * — an empty array therefore rejects all Items. Actor sheets override this
     * so e.g. a Trademark can't be silently embedded on a Threat, where it
     * would never render.
     * @type {string[]|null}
     */
    static ALLOWED_ITEM_TYPES = null;

    /** Options every NCO sheet shares; subclasses merge in their own. */
    static DEFAULT_OPTIONS = {
      window: { resizable: true },
      form: { submitOnChange: true, closeOnSubmit: false },
      actions: {
        editImage: this._onEditImage,
        toggleEdit: this._onToggleEdit,
        invoke: this._onInvoke,
        invokeDanger: this._onInvokeDanger,
        trackAdd: this._onTrackAdd,
        createTag: this._onCreateTag,
        deleteTag: this._onDeleteTag,
        toggleTagPolarity: this._onToggleTagPolarity,
      },
    };

    /** Show just the document name in the title bar, without the type prefix. */
    get title() {
      return this.document.name;
    }

    /**
     * Whether this sheet is currently in edit mode. Cached per open sheet, then
     * gated by edit permission. Starts from {@link _startsBlank} so an empty
     * document opens ready to fill in.
     * @type {boolean|undefined}
     */
    _editing;

    get isEditing() {
      this._editing ??= this._startsBlank();
      return this._editing && this.isEditable;
    }

    /** Whether a fresh document should open in edit mode. Override per sheet. */
    _startsBlank() {
      return false;
    }

    /** Context keys every NCO sheet template expects. Spread into _prepareContext. */
    _baseContext() {
      return {
        document: this.document,
        system: this.document.system,
        editing: this.isEditing,
        editable: this.isEditable,
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

    /** View model for a list of Tags, as positive/negative clickable chips. */
    _prepareTags(tags) {
      return (tags ?? []).map((tag) => {
        const positive = tag.polarity !== TAG_POLARITY.NEGATIVE;
        return {
          text: tag.text,
          positive,
          polarity: positive ? TAG_POLARITY.POSITIVE : TAG_POLARITY.NEGATIVE,
          clickable: !!tag.text?.trim(),
        };
      });
    }

    static _onToggleEdit(_event, _target) {
      this._editing = !this.isEditing;
      this.render();
    }

    /** Open a file picker for the document portrait. */
    static async _onEditImage(_event, _target) {
      const FilePickerImpl = foundry.applications.apps?.FilePicker?.implementation ?? FilePicker;
      const picker = new FilePickerImpl({
        type: "image",
        current: this.document.img,
        callback: (path) => this.document.update({ img: path }),
      });
      return picker.browse();
    }

    /**
     * Click a Tag: add it to the shared roll pool. Positive Tags add an Action
     * die, negative Tags a Danger die; shift-click inverts the polarity. A
     * `data-source` on the chip overrides the crediting document (the Job sheet
     * uses this to credit a linked Scene/Threat).
     */
    static async _onInvoke(event, target) {
      await Tags.invoke({
        text: target.dataset.text,
        polarity: target.dataset.polarity ?? TAG_POLARITY.POSITIVE,
        source: target.dataset.source ?? this.document.name,
        invert: event.shiftKey,
      });
    }

    /**
     * Click the Danger Rating: add that many Danger dice to the shared roll
     * pool. Shift-click adds them as Action dice instead. Uses the document's
     * own rating; sheets that draw foreign ratings (the Job) override this.
     */
    static async _onInvokeDanger(event, _target) {
      const rating = this.document.system.dangerRating ?? 0;
      if (rating <= 0) return;
      await Tags.invoke({
        text: game.i18n.localize("NCO.Sheet.DangerRating"),
        polarity: TAG_POLARITY.NEGATIVE,
        source: this.document.name,
        invert: event.shiftKey,
        count: rating,
      });
    }

    /**
     * Flush any pending form edit, then return a plain copy of the tags array
     * for mutation, so an in-flight submitOnChange update can't clobber the
     * structural change (or vice versa).
     */
    async _tagsForUpdate() {
      if (this.isEditable) await this.submit();
      return this.document.toObject().system.tags ?? [];
    }

    static async _onCreateTag(_event, _target) {
      this._editing = true;
      const tags = await this._tagsForUpdate();
      tags.push({ text: "", polarity: this.constructor.NEW_TAG_POLARITY });
      await this.document.update({ "system.tags": tags });
    }

    static async _onDeleteTag(_event, target) {
      const index = Number(target.dataset.tagIndex);
      const tags = await this._tagsForUpdate();
      if (index < 0 || index >= tags.length) return;
      tags.splice(index, 1);
      await this.document.update({ "system.tags": tags });
    }

    /** Flip a Tag between positive and negative polarity. */
    static async _onToggleTagPolarity(_event, target) {
      const index = Number(target.dataset.tagIndex);
      const tags = await this._tagsForUpdate();
      if (index < 0 || index >= tags.length) return;
      tags[index].polarity = Tags.invert(tags[index].polarity ?? TAG_POLARITY.POSITIVE);
      await this.document.update({ "system.tags": tags });
    }

    /**
     * Reject dropped Items whose type this sheet can't display (see
     * {@link ALLOWED_ITEM_TYPES}); accepted drops fall through to the base
     * ActorSheetV2 embedding. Item-based sheets (Scene, Job) never receive
     * this callback, so the optional chain is safe there.
     * @override
     */
    async _onDropItem(event, item) {
      const allowed = this.constructor.ALLOWED_ITEM_TYPES;
      if (allowed && !allowed.includes(item.type)) {
        ui.notifications.warn(game.i18n.localize("NCO.Sheet.DropUnsupported"));
        return null;
      }
      return super._onDropItem?.(event, item);
    }

    /**
     * Where a clicked track's filled-box count is stored and how high it can go.
     * Return `null` when the named track is unknown (the default, for sheets
     * with no own tracks). Subclasses with damage tracks override this. An
     * optional `document` redirects the update to another document (e.g. an
     * embedded Item's track); it defaults to this sheet's document.
     * @param {string} [_track]  The clicked track's `data-track` value.
     * @returns {{field: string, current: number, max: number, document?: foundry.abstract.Document}|null}
     */
    _trackConfig(_track) {
      return null;
    }

    /**
     * Left-click a track box. The world's "track click mode" setting decides
     * whether this adds a single box ("increment") or fills/clears up to the
     * clicked box ("fill").
     */
    static async _onTrackAdd(event, target) {
      if (!this.isEditable) return;
      const cfg = this._trackConfig(target.dataset.track);
      if (!cfg) return;
      let next;
      if (game.settings.get("foundryvtt-nco", "trackClickMode") === "fill") {
        const box = event.target.closest("[data-index]");
        if (!box) return;
        const index = Number(box.dataset.index);
        // Clicking a filled box clears down to it; an empty box fills up to it.
        next = index < cfg.current ? index : index + 1;
      } else {
        next = cfg.current + 1;
      }
      next = Math.max(0, Math.min(cfg.max, next));
      if (next !== cfg.current) await (cfg.document ?? this.document).update({ [cfg.field]: next });
    }

    /** Right-click a track: clear the last filled box (only in "increment" mode). */
    async _onTrackRemove(event) {
      event.preventDefault();
      if (!this.isEditable) return;
      if (game.settings.get("foundryvtt-nco", "trackClickMode") !== "increment") return;
      const cfg = this._trackConfig(event.currentTarget.dataset.track);
      if (!cfg) return;
      const next = Math.max(0, cfg.current - 1);
      if (next !== cfg.current) await (cfg.document ?? this.document).update({ [cfg.field]: next });
    }

    /**
     * Wire right-click (decrement) on this sheet's own tracks. Right-click isn't
     * an ActionV2 trigger, so it's bound manually; the elements are rebuilt each
     * render, so this re-binds every time. Sheets whose `.nco-track` elements
     * belong to other documents (the Job) override this.
     */
    _bindTrackContextMenu() {
      for (const el of this.element.querySelectorAll(".nco-track")) {
        el.addEventListener("contextmenu", this._onTrackRemove.bind(this));
      }
    }

    /** @override */
    async _onRender(context, options) {
      await super._onRender(context, options);
      this._bindTrackContextMenu();
    }
  };
}
