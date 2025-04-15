import { z } from "zod";

import type {
  Event,
  EventApplicatorInterface,
  EventApplicator as EventApplicatorType,
  EventApplicators,
} from "@stu/lib";
import { NAMESPACES } from "@stu/lib";

import { authApplicators } from "./event-handlers/auth";
import { orgApplicators } from "./event-handlers/org";
import { studentApplicators } from "./event-handlers/student";

export * from "drizzle-orm/sql";

export { alias } from "drizzle-orm/pg-core";

type Extra = unknown;

const applicators: EventApplicators<Extra> = {
  org: orgApplicators,
  student: studentApplicators,
  auth: authApplicators,
};

function findApplicator<TEvent extends Event>(event: Omit<TEvent, "errors">) {
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

export const eventApplicator: EventApplicatorInterface = {
  async verify(event, { initiatorUserId }) {
    const applicator = findApplicator(event);
    if (!applicator) {
      return Promise.resolve(undefined);
    }

    // eslint-disable-next-line
    return applicator.verify(event as any, {
      initiatorUserId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  },

  async apply(event: Omit<Event, "errors">) {
    const applicator = findApplicator(event);
    if (!applicator) {
      return;
    }

    await applicator.apply(event, {});
  },

  async topics(event: Omit<Event, "errors">) {
    const applicator = findApplicator(event);
    if (!applicator) {
      return Promise.resolve([]);
    }

    return applicator.topics?.(event, {}) ?? [];
  },
};
