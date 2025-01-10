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

  private findApplicator<TEvent extends Event>(event: Omit<TEvent, "errors">) {
    const applicatorDirect = applicators[event.type] as
      | EventApplicatorType<TEvent["type"], Extra>
      | undefined;

    const [ns, ...rest] = event.type.split(".");
    if (!ns) return applicatorDirect;
    const namespace = z.enum(NAMESPACES).parse(ns);

    const applicatorNamespace = applicators[namespace];
    const eventName = rest.join(".") as keyof typeof applicatorNamespace;
    return applicatorNamespace?.[eventName] as
      | EventApplicatorType<TEvent["type"], Extra>
      | undefined;
  }

  private getUser() {
    // TODO: Make isOfAge dynamic
    return { isOfAge: true, userId: this.userId };
  }

  verify<TEvent extends Event>(event: Omit<TEvent, "errors">) {
    const applicator = this.findApplicator(event);
    if (!applicator) {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return applicator.verify(event as any, {
      db: this.db,
      user: this.getUser(),
      initiatorUserId: this.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  }

  async apply(event: Omit<Event, "errors">) {
    const applicator = this.findApplicator(event);
    if (!applicator) {
      return;
    }

    await applicator.apply(event, { db: this.db, user: this.getUser() });
  }
}
