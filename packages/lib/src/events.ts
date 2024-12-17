import { z } from "zod";

import { GRADE_TYPES } from "./grades";

const DomainEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("absence.recorded"),
    data: z.object({
      date: z.date(),
      reason: z.string(),
      courseIds: z.array(z.string()).min(1),
    }),
  }),
  z.object({
    type: z.literal("absence.parentApproved"),
    data: z.object({
      date: z.date(),
      signature: z.string(),
    }),
  }),
  z.object({
    type: z.literal("absence.teacherApproved"),
    data: z.object({
      date: z.date(),
      courseId: z.string(),
      signature: z.string(),
    }),
  }),
  z.object({
    type: z.literal("absence.discarded"),
    data: z.object({
      date: z.date(),
      courseIds: z.array(z.string()),
    }),
  }),

  z.object({
    type: z.literal("grades.currentGradeSet"),
    data: z.object({
      courseId: z.string(),
      date: z.date(),
      result: z.number(),
      type: z.enum(GRADE_TYPES),
    }),
  }),
  z.object({
    type: z.literal("grades.writtenGradeRecorded"),
    data: z.object({
      courseId: z.string(),
      date: z.date(),
      result: z.number(),
    }),
  }),
  z.object({
    type: z.literal("grades.teacherApproved"),
    data: z.object({
      date: z.date(),
      course: z.string(),
      type: z.enum(GRADE_TYPES),
      signature: z.string(),
    }),
  }),
  z.object({
    type: z.literal("grades.parentApproved"),
    data: z.object({
      date: z.date(),
      course: z.string(),
      type: z.enum(GRADE_TYPES),
      signature: z.string(),
    }),
  }),
  z.object({
    type: z.literal("grades.discarded"),
    data: z.object({
      course: z.string(),
      type: z.enum(GRADE_TYPES),
      date: z.date(),
    }),
  }),
  z.object({
    type: z.literal("grades.latestRestored"),
    data: z.object({
      course: z.string(),
      type: z.enum(GRADE_TYPES),
    }),
  }),

  // z.object({
  //   type: z.literal("student.classAssigned"),
  //   data: z.object({}),
  // }),
  // z.object({
  //   type: z.literal("student.courseAssigned"),
  //   data: z.object({}),
  // }),

  // z.object({
  //   type: z.literal("user.activated"),
  //   data: z.object({}),
  // }),
]);

export const Event = DomainEvent.and(
  z.object({
    id: z.string(),
    timestamp: z.coerce.date(),
  }),
);
export type Event = z.infer<typeof Event>;
export type EventName = Event["type"];
export const EVENT_TYPES = DomainEvent.options.map(
  (thing) => thing.shape.type.value,
) as [EventName, ...EventName[]]; // Assure TS that it's non-empty

export interface EventApplicator<TEventName extends Event["type"], Extra> {
  verify: (
    event: Extract<Event, { type: TEventName }>,
    extra: Extra,
  ) => Promise<boolean>;
  apply: (
    event: Extract<Event, { type: TEventName }>,
    extra: Extra,
  ) => Promise<void>;
}

interface PersistedEvent {
  id: string;
  order: number;
  type: EventName;
  data: Record<string, unknown>;
  timestamp: Date;
  initator: string;
}

export interface ServerEventApplicator<TEventName extends Event["type"]> {
  recipients?: (
    event: Extract<Event, { type: TEventName }>,
  ) => Promise<string[]>; // Returns user IDs
  related?: (
    event: Extract<Event, { type: TEventName }>,
  ) => Promise<PersistedEvent[]>;
}

export const NAMESPACES = ["absence", "grades"] as const;
type Namespace = (typeof NAMESPACES)[number];
export type NamespaceEventApplicators<TNamespace extends Namespace, Extra> = {
  [TEventName in Event["type"] as TEventName extends `${TNamespace}.${infer T}`
    ? T
    : never]: EventApplicator<TEventName, Extra>;
};

export type EventApplicators<Extra> = {
  [TEventName in Event["type"]]?: EventApplicator<TEventName, Extra>;
} & {
  [TNamespace in Namespace]?: NamespaceEventApplicators<TNamespace, Extra>;
};

export interface EventApplicatorInterface {
  verify: (event: Event) => Promise<boolean>;
  apply: (event: Event) => Promise<void>;
}

export type ServerEventApplicators = {
  [TEventName in Event["type"]]?: ServerEventApplicator<TEventName>;
};
