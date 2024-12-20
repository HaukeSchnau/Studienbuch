import {
  array,
  date,
  discriminatedUnion,
  literal,
  number,
  object,
  string,
  z,
} from "zod";

import { GRADE_TYPES } from "./grades";
import { SCHOOL_IDS, SEMESTER_TYPES, STATE_CODES } from "./schools";
import { SALUTATIONS } from "./users";

const DomainEvent = discriminatedUnion("type", [
  object({
    type: literal("absence.recorded"),
    data: object({
      date: date(),
      reason: string(),
      courseIds: array(string().uuid()).min(1),
    }),
  }),
  object({
    type: literal("absence.parentApproved"),
    data: object({
      date: date(),
      signature: string(),
    }),
  }),
  object({
    type: literal("absence.teacherApproved"),
    data: object({
      date: date(),
      courseId: string().uuid(),
      signature: string(),
    }),
  }),
  object({
    type: literal("absence.discarded"),
    data: object({
      date: date(),
      courseIds: array(string().uuid()),
    }),
  }),

  object({
    type: literal("grades.currentGradeSet"),
    data: object({
      courseId: string().uuid(),
      date: date(),
      result: number(),
      type: z.enum(GRADE_TYPES),
    }),
  }),
  object({
    type: literal("grades.writtenGradeRecorded"),
    data: object({
      courseId: string(),
      date: date(),
      result: number(),
    }),
  }),
  object({
    type: literal("grades.teacherApproved"),
    data: object({
      date: date(),
      course: string(),
      type: z.enum(GRADE_TYPES),
      signature: string(),
    }),
  }),
  object({
    type: literal("grades.parentApproved"),
    data: object({
      date: date(),
      course: string().uuid(),
      type: z.enum(GRADE_TYPES),
      signature: string(),
    }),
  }),
  object({
    type: literal("grades.discarded"),
    data: object({
      course: string().uuid(),
      type: z.enum(GRADE_TYPES),
      date: date(),
    }),
  }),
  object({
    type: literal("grades.latestRestored"),
    data: object({
      course: string().uuid(),
      type: z.enum(GRADE_TYPES),
    }),
  }),

  object({
    type: literal("org.school.founded"),
    data: object({
      id: z.enum(SCHOOL_IDS),
      name: string(),
      state: z.enum(STATE_CODES),
    }),
  }),
  object({
    type: literal("org.year.started"),
    data: object({
      name: string(),
      startYear: number(),
      graduationYear: number(),
      school: z.enum(SCHOOL_IDS),
      classes: array(
        object({
          identifierInYear: string(),
          teachers: array(string().uuid()),
        }),
      ),
    }),
  }),
  object({
    type: literal("org.teacher.joined"),
    data: object({
      personId: string().uuid(),
      name: string(),
      abbrv: string(),
      salutation: z.enum(SALUTATIONS).optional(),
      school: z.enum(SCHOOL_IDS),
    }),
  }),
  object({
    type: literal("org.holiday.created"),
    data: object({
      name: string(),
      start: date(),
      end: date(),
      state: z.enum(STATE_CODES),
      year: number(),
    }),
  }),
  object({
    type: literal("org.courses.created"),
    data: object({
      id: string().uuid(),
      name: string(),
      longName: string(),
      subject: z.enum(GRADE_TYPES),
      school: z.enum(SCHOOL_IDS),
      semesterType: z.enum(SEMESTER_TYPES),
      semesterYear: number(),
      classes: array(
        object({
          identifierInYear: string(),
          startYear: number(),
        }),
      ),
      teachers: array(string().uuid()),
    }),
  }),
  object({
    type: literal("org.timetable.entryCreated"),
    data: object({
      course: string().uuid(),
      start: date(),
      duration: number(),
      rooms: array(string()),
    }),
  }),
  object({
    type: literal("org.timetable.substituted"),
    data: object({
      course: string().uuid(),
      start: date(),
      substitute: string().uuid(),
    }),
  }),
  object({
    type: literal("org.timetable.canceled"),
    data: object({
      course: string().uuid(),
      start: date(),
    }),
  }),

  // object({
  //   type: literal("student.classAssigned"),
  //   data: object({}),
  // }),
  // object({
  //   type: literal("student.courseAssigned"),
  //   data: object({}),
  // }),

  // object({
  //   type: literal("user.activated"),
  //   data: object({}),
  // }),
]);

export const Event = DomainEvent.and(
  object({
    id: string().uuid(),
    timestamp: date(),
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

export const NAMESPACES = ["absence", "grades", "org"] as const;
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
