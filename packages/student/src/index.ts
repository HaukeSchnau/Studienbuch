import { eq } from "drizzle-orm";
import { z } from "zod";

import type {
  Event,
  EventApplicatorInterface,
  EventApplicators,
  EventApplicator as EventApplicatorType,
  PersistedEvent,
} from "@stu/lib";
import { NAMESPACES } from "@stu/lib";

import type { DB, Extra } from "./event-handlers/types";
import { absenceApplicators } from "./event-handlers/absences";
import { gradeApplicators } from "./event-handlers/grades";
import { orgApplicators } from "./event-handlers/org";
import { studentApplicators } from "./event-handlers/student";
import * as tables from "./schema";

const applicators: EventApplicators<Extra> = {
  absence: absenceApplicators,
  grades: gradeApplicators,
  org: orgApplicators,
  student: studentApplicators,
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

    // TODO: try/catch and return result type
    await applicator.apply(event, { db: this.db, user: this.getUser() });
  }

  async isEventAlreadyKnown(event: PersistedEvent) {
    const existingEvent = await this.db.query.events.findFirst({
      where: eq(tables.events.id, event.id),
    });
    return existingEvent !== undefined;
  }
}
