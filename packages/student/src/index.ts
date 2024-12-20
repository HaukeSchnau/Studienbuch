import { z } from "zod";

import type {
  Event,
  EventApplicatorInterface,
  EventApplicators,
  EventApplicator as EventApplicatorType,
} from "@stu/lib";
import { NAMESPACES } from "@stu/lib";

import type { DB, Extra } from "./event-handlers/types";
import { absenceApplicators } from "./event-handlers/absences";
import { gradeApplicators } from "./event-handlers/grades";
import { orgApplicators } from "./event-handlers/org";

const applicators: EventApplicators<Extra> = {
  absence: absenceApplicators,
  grades: gradeApplicators,
  org: orgApplicators,
};

export class EventApplicator implements EventApplicatorInterface {
  constructor(
    private db: DB,
    private userId: string,
  ) {}

  private findApplicator(event: Event) {
    type AnyEventApplicator = EventApplicatorType<typeof event.type, Extra>;

    const applicatorDirect = applicators[event.type] as
      | AnyEventApplicator
      | undefined;

    const [ns, ...rest] = event.type.split(".");
    if (!ns) return applicatorDirect;
    const namespace = z.enum(NAMESPACES).parse(ns);

    const applicatorNamespace = applicators[namespace];
    const eventName = rest.join(".") as keyof typeof applicatorNamespace;
    return applicatorNamespace?.[eventName] as AnyEventApplicator | undefined;
  }

  private getUser() {
    return { isOfAge: true, userId: this.userId };
  }

  async verify(event: Event) {
    const applicator = this.findApplicator(event);
    if (!applicator) {
      return true;
    }

    return await applicator.verify(event, {
      db: this.db,
      user: this.getUser(),
    });
  }

  async apply(event: Event) {
    const applicator = this.findApplicator(event);
    if (!applicator) {
      return;
    }

    await applicator.apply(event, { db: this.db, user: this.getUser() });
  }
}
