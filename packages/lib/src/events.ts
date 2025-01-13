import {
  array,
  boolean,
  date,
  discriminatedUnion,
  literal,
  number,
  object,
  preprocess,
  string,
  z,
} from "zod";

import { SUBJECT_IDS } from "./courses";
import { GRADE_TYPES } from "./grades";
import { SCHOOL_IDS, SEMESTER_TYPES, STATE_CODES } from "./schools";
import { SALUTATIONS } from "./users";

const virtual = <const T>(type: T) =>
  z
    .any()
    .optional()
    .transform(() => type);

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
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
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
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),
  object({
    type: literal("org.teacher.joined"),
    data: object({
      personId: string().uuid(),
      firstName: string().optional(),
      lastName: string().optional(),
      abbrv: string(),
      salutation: z.enum(SALUTATIONS).optional(),
      school: z.enum(SCHOOL_IDS),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
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
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),
  object({
    type: literal("org.courses.created"),
    data: object({
      id: string().uuid(),
      name: string(),
      longName: string(),
      subject: z.enum(SUBJECT_IDS),
      isMandatory: boolean(),
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
    errors: virtual(["EXISTS", "CLASS_NOT_FOUND", "NOT_ALLOWED"]),
  }),

  object({
    type: literal("org.timetable.entryCreated"),
    data: object({
      course: string().uuid(),
      start: date(),
      duration: number(),
      rooms: array(string()),
    }),
    errors: virtual(["NOT_ALLOWED", "COURSE_NOT_FOUND"]),
  }),
  object({
    type: literal("org.timetable.substituted"),
    data: object({
      course: string().uuid(),
      start: date(),
      originalTeacher: string().uuid(),
      substitute: string().uuid(),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),
  object({
    type: literal("org.timetable.canceled"),
    data: object({
      course: string().uuid(),
      start: date(),
      originalTeacher: string().uuid(),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),

  object({
    type: literal("auth.licenseGenerated"),
    data: object({
      licenseKey: string(),
      school: z.enum(SCHOOL_IDS),
      expiryDate: date(),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),

  object({
    type: literal("auth.licenseActivated"),
    data: object({
      userId: string().uuid(),
      licenseKey: string(),
    }),
    errors: virtual(["EXISTS", "INVALID_LICENSE_KEY"]),
  }),

  object({
    type: literal("student.joined"),
    data: object({
      studentId: string().uuid(),
      name: string(),
      school: z.enum(SCHOOL_IDS),
      isOfAge: boolean(),
      class: object({
        identifier: string(),
        startYear: number(),
      }),
    }),
    errors: virtual(["NOT_ALLOWED", "INVALID_CLASS"]),
  }),

  object({
    type: literal("student.courseAssigned"),
    data: object({
      studentId: string().uuid(),
      courseId: string().uuid(),
    }),
    errors: virtual(["ALREADY_ASSIGNED", "NOT_ALLOWED", "INVALID_COURSE"]),
  }),
]);

export const Event = preprocess(
  (input) => (typeof input === "object" ? { ...input, errors: [] } : input),
  z.object({}),
)
  .and(DomainEvent)
  .and(
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

export interface BaseExtra {
  initiatorUserId: string;
}

export interface EventApplicator<TEventName extends Event["type"], Extra> {
  verify: (
    event: Omit<Extract<Event, { type: TEventName }>, "errors">,
    extra: Extra & BaseExtra,
  ) => Promise<EventErrorsByName<TEventName>>;
  apply: (
    event: Omit<Extract<Event, { type: TEventName }>, "errors">,
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
    event: Omit<Extract<Event, { type: TEventName }>, "errors">,
    extra: BaseExtra,
  ) => Promise<string[]>; // Returns user IDs
  relatedEvents?: (
    event: Omit<Extract<Event, { type: TEventName }>, "errors">,
    extra: BaseExtra,
  ) => Promise<PersistedEvent[]>;
  entities?: (
    event: Omit<Extract<Event, { type: TEventName }>, "errors">,
    extra: BaseExtra,
  ) => Promise<string[]>; // Returns entity IDs
}

export const NAMESPACES = [
  "absence",
  "grades",
  "org",
  "student",
  "auth",
] as const;
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
  verify: <TEvent extends Event>(
    event: Omit<TEvent, "errors">,
    extra: BaseExtra,
  ) => Promise<EventErrorsByEvent<TEvent>>;
  apply: (event: Omit<Event, "errors">) => Promise<void>;
}

export type ServerEventApplicators = {
  [TEventName in Event["type"]]: ServerEventApplicator<TEventName>;
};

export type EventErrorsByName<TEventName extends Event["type"]> =
  EventErrorsByEvent<Extract<Event, { type: TEventName }>>;

export type EventErrorsByEvent<TEvent extends Event> =
  | ("errors" extends keyof TEvent
      ? TEvent["errors"] extends readonly (infer E)[]
        ? E
        : TEvent["errors"]
      : never)
  | "UNEXPECTED"
  | undefined;

export type EventDataByName<TEventName extends Event["type"]> = Extract<
  Event,
  { type: TEventName }
>["data"];
