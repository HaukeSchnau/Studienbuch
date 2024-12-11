import { z } from "zod";

export const Event = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("absence.recorded"),
      data: z.object({
        absenceId: z.string(),
      }),
    }),
    z.object({
      type: z.literal("absence.parentApproved"),
      data: z.object({}),
    }),
    // z.object({
    //   type: z.literal("absence.teacherApproved"),
    //   data: z.object({}),
    // }),
    // z.object({
    //   type: z.literal("absence.discarded"),
    //   data: z.object({}),
    // }),

    // z.object({
    //   type: z.literal("grades.currentGradeSet"),
    //   data: z.object({}),
    // }),
    // z.object({
    //   type: z.literal("grades.writtenGradeRecorded"),
    //   data: z.object({}),
    // }),
    // z.object({
    //   type: z.literal("grades.parentApproved"),
    //   data: z.object({}),
    // }),
    // z.object({
    //   type: z.literal("grades.teacherApproved"),
    //   data: z.object({}),
    // }),
    // z.object({
    //   type: z.literal("grades.discarded"),
    //   data: z.object({}),
    // }),
    // z.object({
    //   type: z.literal("grades.latestRestored"),
    //   data: z.object({}),
    // }),

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
  ])
  .and(
    z.object({
      id: z.string(),
      timestamp: z.coerce.date(),
    }),
  );
export type Event = z.infer<typeof Event>;
export type EventName = Event["type"];

export interface EventApplicator<TEventName extends Event["type"]> {
  verify: (event: Extract<Event, { type: TEventName }>) => Promise<boolean>;
  apply: (event: Extract<Event, { type: TEventName }>) => Promise<void>;
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

export type EventApplicators = {
  [TEventName in Event["type"]]?: EventApplicator<TEventName>;
};

export interface EventApplicatorInterface {
  verify: (event: Event) => Promise<boolean>;
  apply: (event: Event) => Promise<void>;
}

export type ServerEventApplicators = {
  [TEventName in Event["type"]]?: ServerEventApplicator<TEventName>;
};
