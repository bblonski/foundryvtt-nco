import { TAG_POLARITY } from "../tags.js";

/**
 * System data for the "scene" Item type.
 *
 * A Scene represents the situation or location the action takes place in. It is
 * the simplest tag-bearing element: just a Name (the Item's own name) and a list
 * of Tags. Each Tag is independently positive (an Action die when invoked) or
 * negative (a Danger die), like Vehicle and Threat Tags.
 *
 * New Tags default to positive, since a Scene's Tags are as likely to help the
 * PCs ("Crowded Market") as hinder them ("Pouring Rain").
 */
export class SceneData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      // Tags: each is independently positive (Action die) or negative (Danger
      // die) when invoked, like Vehicle and Threat Tags.
      tags: new fields.ArrayField(
        new fields.SchemaField({
          text: new fields.StringField({ required: true, blank: true, initial: "" }),
          polarity: new fields.StringField({
            required: true,
            initial: TAG_POLARITY.POSITIVE,
            choices: [TAG_POLARITY.POSITIVE, TAG_POLARITY.NEGATIVE],
          }),
        }),
      ),
    };
  }
}
