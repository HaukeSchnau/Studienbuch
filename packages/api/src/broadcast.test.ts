import { type CanonicalStorage, CanonicalStorageError } from "@groundswell/core-server";
import type { DomainEvent } from "@stu/lib";
import { Effect, Fiber, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { DomainBroadcast, DomainCanonicalStorage } from "./boilerplate";
import { memoryBroadcastLive } from "./broadcast";

const STUDENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STUDENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COURSE_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COURSE_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const makeAbsenceRecordedEvent = (id: string, studentId: string, courseId: string, timestamp: Date): DomainEvent => ({
  id,
  timestamp,
  type: "absence.recorded",
  data: {
    studentId,
    date: timestamp,
    reason: "Krank",
    courseIds: [courseId],
  },
});

const makeCanonicalStorageMock = (events: DomainEvent[]) => {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const sentIdsByUser = new Map<string, string[]>();
  const sentIdSetByUser = new Map<string, Set<string>>();

  const service: CanonicalStorage<DomainEvent> = {
    isEventUnique: () => Effect.succeed(true),
    saveEvent: () => Effect.void,
    getMissingEventsForUser: () => Effect.succeed([]),
    getEventsSentToUser: (userId) =>
      Effect.sync(() => {
        const ids = sentIdsByUser.get(userId) ?? [];
        return ids.flatMap((id) => {
          const event = eventById.get(id);
          return event ? [event] : [];
        });
      }),
    markEventAsSentToUser: (eventId, userId) =>
      Effect.gen(function* () {
        const userSet = sentIdSetByUser.get(userId) ?? new Set<string>();
        const userIds = sentIdsByUser.get(userId) ?? [];
        if (userSet.has(eventId)) {
          return yield* Effect.fail(
            new CanonicalStorageError({
              cause: {
                type: "unique_violation",
                message: `event ${eventId} already sent`,
              },
            }),
          );
        }
        userSet.add(eventId);
        userIds.push(eventId);
        sentIdSetByUser.set(userId, userSet);
        sentIdsByUser.set(userId, userIds);
      }),
  };

  return {
    service,
    sentIdsByUser,
  };
};

const runBroadcastProgram = <A>(
  program: Effect.Effect<A, unknown, DomainBroadcast>,
  storage: CanonicalStorage<DomainEvent>,
) =>
  Effect.runPromise(
    program.pipe(Effect.provide(memoryBroadcastLive), Effect.provideService(DomainCanonicalStorage, storage)),
  );

describe("memoryBroadcastLive", () => {
  it("replays from offset and preserves order", async () => {
    const first = makeAbsenceRecordedEvent("11111111-1111-4111-8111-111111111111", STUDENT_A, COURSE_A, new Date(1));
    const second = makeAbsenceRecordedEvent("22222222-2222-4222-8222-222222222222", STUDENT_A, COURSE_B, new Date(2));
    const storage = makeCanonicalStorageMock([first, second]);

    const replay = await runBroadcastProgram(
      Effect.gen(function* () {
        const broadcast = yield* DomainBroadcast;
        yield* broadcast.publishToUser(STUDENT_A, [first, second]);
        return yield* Stream.runCollect(broadcast.subscribe(STUDENT_A, { offset: 1 }).pipe(Stream.take(1)));
      }),
      storage.service,
    );

    expect(Array.from(replay)).toEqual([second]);
  });

  it("does not duplicate canonical sent markers for already-sent events", async () => {
    const event = makeAbsenceRecordedEvent("33333333-3333-4333-8333-333333333333", STUDENT_A, COURSE_A, new Date(3));
    const storage = makeCanonicalStorageMock([event]);

    await runBroadcastProgram(
      Effect.gen(function* () {
        const broadcast = yield* DomainBroadcast;
        yield* broadcast.publishToUser(STUDENT_A, [event]);
        yield* broadcast.publishToUser(STUDENT_A, [event]);
      }),
      storage.service,
    );

    expect(storage.sentIdsByUser.get(STUDENT_A)).toEqual([event.id]);
  });

  it("emits live events only to the matching user stream", async () => {
    const eventA = makeAbsenceRecordedEvent("44444444-4444-4444-8444-444444444444", STUDENT_A, COURSE_A, new Date(4));
    const eventB = makeAbsenceRecordedEvent("55555555-5555-4555-8555-555555555555", STUDENT_B, COURSE_B, new Date(5));
    const storage = makeCanonicalStorageMock([eventA, eventB]);

    const firstLiveEvent = await runBroadcastProgram(
      Effect.gen(function* () {
        const broadcast = yield* DomainBroadcast;

        const firstMessageFiber = yield* Stream.runHead(broadcast.subscribe(STUDENT_A, { offset: 0 })).pipe(
          Effect.fork,
        );

        yield* broadcast.publishToUser(STUDENT_B, [eventB]);
        yield* broadcast.publishToUser(STUDENT_A, [eventA]);

        return yield* Fiber.join(firstMessageFiber);
      }),
      storage.service,
    );

    expect(firstLiveEvent).toEqual(Option.some(eventA));
  });
});
