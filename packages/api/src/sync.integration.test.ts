import { ApplicatorError, ValidationError } from "@groundswell/core";
import {
  type CanonicalStorage,
  CanonicalStorageError,
  type ServerApplicator,
  UserNotFoundError,
} from "@groundswell/core-server";
import type { DomainEvent } from "@stu/lib";
import { studentsOfUser } from "@stu/lib";
import { Effect, Fiber, Layer, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";
import {
  DomainBroadcast,
  DomainCanonicalStorage,
  DomainIngestEngine,
  DomainServerApplicator,
  ingestEngine,
} from "./boilerplate";
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

const isStudentScopedEvent = (event: DomainEvent): event is Extract<DomainEvent, { data: { studentId: string } }> =>
  "studentId" in event.data && typeof event.data.studentId === "string";

const uniqueViolation = (message: string) =>
  new CanonicalStorageError({
    cause: {
      type: "unique_violation",
      message,
    },
  });

const createHarness = () => {
  const storedEvents: Array<{ event: DomainEvent; topics: string[] }> = [];
  const eventById = new Map<string, DomainEvent>();
  const sentIdsByUser = new Map<string, string[]>();
  const sentSetByUser = new Map<string, Set<string>>();
  const appliedEventIds: string[] = [];

  const userTopicsByUser = new Map<string, string[]>([
    [STUDENT_A, [studentsOfUser(STUDENT_A)]],
    [STUDENT_B, [studentsOfUser(STUDENT_B)]],
  ]);

  const canonicalStorage: CanonicalStorage<DomainEvent> = {
    isEventUnique: (eventId) => Effect.succeed(!eventById.has(eventId)),
    saveEvent: (event, meta) =>
      Effect.sync(() => {
        if (eventById.has(event.id)) {
          throw uniqueViolation(`event ${event.id} already exists`);
        }
        eventById.set(event.id, event);
        storedEvents.push({ event, topics: meta.topics });
      }),
    getMissingEventsForUser: (userId, topics) =>
      Effect.sync(() => {
        const sentSet = sentSetByUser.get(userId) ?? new Set<string>();

        return storedEvents
          .filter(
            ({ event, topics: eventTopics }) =>
              !sentSet.has(event.id) && eventTopics.some((topic) => topics.includes(topic)),
          )
          .map(({ event }) => event)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      }),
    getEventsSentToUser: (userId) =>
      Effect.sync(() => {
        const sentIds = sentIdsByUser.get(userId) ?? [];
        return sentIds.flatMap((id) => {
          const event = eventById.get(id);
          return event ? [event] : [];
        });
      }),
    markEventAsSentToUser: (eventId, userId) =>
      Effect.gen(function* () {
        const set = sentSetByUser.get(userId) ?? new Set<string>();
        const orderedIds = sentIdsByUser.get(userId) ?? [];

        if (set.has(eventId)) {
          return yield* Effect.fail(uniqueViolation(`event ${eventId} already sent to ${userId}`));
        }

        set.add(eventId);
        orderedIds.push(eventId);
        sentSetByUser.set(userId, set);
        sentIdsByUser.set(userId, orderedIds);
      }),
  };

  const serverApplicator: ServerApplicator<DomainEvent> = {
    verify: (event, meta) =>
      Effect.gen(function* () {
        if (isStudentScopedEvent(event) && event.data.studentId !== meta.initiatorId) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        if (isStudentScopedEvent(event)) {
          appliedEventIds.push(event.id);
          return;
        }
        return yield* Effect.fail(new ApplicatorError({ cause: "UNSUPPORTED_EVENT_IN_TEST" }));
      }),
    getEventTopics: (event) =>
      Effect.succeed(isStudentScopedEvent(event) ? [studentsOfUser(event.data.studentId)] : []),
    getUserTopics: (userId) => {
      const topics = userTopicsByUser.get(userId);
      return topics ? Effect.succeed(topics) : Effect.fail(new UserNotFoundError({ userId }));
    },
  };

  const canonicalStorageLayer = Layer.succeed(DomainCanonicalStorage, canonicalStorage);
  const serverApplicatorLayer = Layer.succeed(DomainServerApplicator, serverApplicator);
  const layer = ingestEngine.pipe(
    Layer.provideMerge(memoryBroadcastLive),
    Layer.provideMerge(canonicalStorageLayer),
    Layer.provideMerge(serverApplicatorLayer),
  );

  const run = <A>(effect: Effect.Effect<A, unknown, DomainBroadcast | DomainIngestEngine>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)));

  return {
    run,
    appliedEventIds,
    sentIdsByUser,
  };
};

describe("sync ingest integration", () => {
  it("delivers one ingested event to multiple live subscribers for the same user", async () => {
    const harness = createHarness();
    const event = makeAbsenceRecordedEvent("11111111-1111-4111-8111-111111111111", STUDENT_A, COURSE_A, new Date(1));

    const result = await harness.run(
      Effect.gen(function* () {
        const ingest = yield* DomainIngestEngine;
        const broadcast = yield* DomainBroadcast;

        const deviceOne = yield* Stream.runHead(broadcast.subscribe(STUDENT_A, { offset: 0 })).pipe(Effect.fork);
        const deviceTwo = yield* Stream.runHead(broadcast.subscribe(STUDENT_A, { offset: 0 })).pipe(Effect.fork);

        yield* ingest.ingest(event, { initiatorId: STUDENT_A });

        return {
          deviceOne: yield* Fiber.join(deviceOne),
          deviceTwo: yield* Fiber.join(deviceTwo),
        };
      }),
    );

    expect(result.deviceOne).toEqual(Option.some(event));
    expect(result.deviceTwo).toEqual(Option.some(event));
    expect(harness.appliedEventIds).toEqual([event.id]);
    expect(harness.sentIdsByUser.get(STUDENT_A)).toEqual([event.id]);
  });

  it("replays from offset on reconnect without duplicating already-consumed events", async () => {
    const harness = createHarness();
    const first = makeAbsenceRecordedEvent("22222222-2222-4222-8222-222222222222", STUDENT_A, COURSE_A, new Date(2));
    const second = makeAbsenceRecordedEvent("33333333-3333-4333-8333-333333333333", STUDENT_A, COURSE_B, new Date(3));

    const result = await harness.run(
      Effect.gen(function* () {
        const ingest = yield* DomainIngestEngine;
        const broadcast = yield* DomainBroadcast;

        yield* ingest.ingest(first, { initiatorId: STUDENT_A });
        yield* ingest.ingest(second, { initiatorId: STUDENT_A });

        const replay = yield* Stream.runCollect(broadcast.subscribe(STUDENT_A, { offset: 1 }).pipe(Stream.take(1)));
        const duplicateCheck = yield* Effect.race(
          Stream.runHead(broadcast.subscribe(STUDENT_A, { offset: 2 })).pipe(Effect.as("event" as const)),
          Effect.sleep("100 millis").pipe(Effect.as("timeout" as const)),
        );

        return {
          replay: Array.from(replay),
          duplicateCheck,
        };
      }),
    );

    expect(result.replay).toEqual([second]);
    expect(result.duplicateCheck).toBe("timeout");
    expect(harness.sentIdsByUser.get(STUDENT_A)).toEqual([first.id, second.id]);
  });

  it("keeps events isolated by user stream", async () => {
    const harness = createHarness();
    const event = makeAbsenceRecordedEvent("44444444-4444-4444-8444-444444444444", STUDENT_A, COURSE_A, new Date(4));

    const result = await harness.run(
      Effect.gen(function* () {
        const ingest = yield* DomainIngestEngine;
        const broadcast = yield* DomainBroadcast;

        const otherUserFiber = yield* Stream.runHead(broadcast.subscribe(STUDENT_B, { offset: 0 })).pipe(Effect.fork);
        yield* ingest.ingest(event, { initiatorId: STUDENT_A });

        const userBResult = yield* Effect.race(
          Fiber.join(otherUserFiber).pipe(Effect.as("received" as const)),
          Effect.sleep("100 millis").pipe(Effect.as("timeout" as const)),
        );
        yield* Fiber.interrupt(otherUserFiber);

        const userAReplay = yield* Stream.runHead(broadcast.subscribe(STUDENT_A, { offset: 0 }));

        return {
          userBResult,
          userAReplay,
        };
      }),
    );

    expect(result.userBResult).toBe("timeout");
    expect(result.userAReplay).toEqual(Option.some(event));
    expect(harness.sentIdsByUser.get(STUDENT_B)).toBeUndefined();
  });
});
