/**
 * System data for the "job" Actor type.
 *
 * A Job is the planning hub for a mission/adventure. It is mostly freeform text
 * — a Concept, Objective, Obstacles, and a Link (the hook tying the PCs in) —
 * plus two lists of related Actors: the Scenes the Job takes place in and the
 * Threats opposing the PCs. The related Actors are stored by UUID and rendered
 * inline on the sheet so their Tags can be invoked without opening each one.
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
      // Related Actors, stored by UUID. Scenes and Threats are dropped onto the
      // sheet and resolved for display (and Tag invocation) at render time.
      scenes: new fields.ArrayField(new fields.StringField({ required: true, blank: false })),
      threats: new fields.ArrayField(new fields.StringField({ required: true, blank: false })),
    };
  }
}
