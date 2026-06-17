/**
 * System data for the "job" Item type.
 *
 * A Job is the planning hub for a mission/adventure. It is mostly freeform text
 * — a Concept, Objective, Obstacles, and a Link (the hook tying the PCs in) —
 * plus two lists of related documents: the Scenes (Items) the Job takes place
 * in and the Threats (Actors) opposing the PCs. They are stored by UUID and
 * rendered inline on the sheet so their Tags can be invoked without opening each.
 */
export class JobData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      // Freeform text fields describing the Job. The Name is the Actor's own
      // built-in `name`, so it is not duplicated here.
      concept: new fields.StringField({ required: true, blank: true, initial: "" }),
      objective: new fields.StringField({ required: true, blank: true, initial: "" }),
      obstacles: new fields.StringField({ required: true, blank: true, initial: "" }),
      link: new fields.StringField({ required: true, blank: true, initial: "" }),
      // Related documents, stored by UUID. Scenes (Items) and Threats (Actors)
      // are dropped onto the sheet and resolved for display (and Tag invocation)
      // at render time.
      scenes: new fields.ArrayField(new fields.StringField({ required: true, blank: false })),
      threats: new fields.ArrayField(new fields.StringField({ required: true, blank: false })),
    };
  }
}
