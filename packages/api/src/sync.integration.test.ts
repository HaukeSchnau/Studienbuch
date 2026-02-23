import {
  ApplicatorError,
  DuplicateEventError,
  type LocalEvent,
  type LocalEventStatus,
  type Storage,
  StorageError,
  type SyncEngine,
  syncEngineLive,
  type Transport,
  TransportError,
  ValidationError,
} from "@groundswell/core";
import {
  type CanonicalStorage,
  CanonicalStorageError,
  type ServerApplicator,
  UserNotFoundError,
} from "@groundswell/core-server";
import type { DomainEvent } from "@stu/lib";
import { studentsOfUser } from "@stu/lib";
import { Context, Effect, Exit, Fiber, Layer, ManagedRuntime, Option, Stream } from "effect";
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

class ClientApplicator extends Context.Tag("test/ClientApplicator")<
  ClientApplicator,
  {
    verify: (event: DomainEvent) => Effect.Effect<void, ValidationError>;
    apply: (event: DomainEvent) => Effect.Effect<void, ApplicatorError>;
  }
>() {}

class ClientStorage extends Context.Tag("test/ClientStorage")<ClientStorage, Storage<DomainEvent>>() {}

class ClientTransport extends Context.Tag("test/ClientTransport")<ClientTransport, Transport<DomainEvent>>() {}

class ClientSyncEngine extends Context.Tag("test/ClientSyncEngine")<ClientSyncEngine, SyncEngine<DomainEvent>>() {}

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

  const getServerServices = () =>
    run(
      Effect.gen(function* () {
        return {
          ingest: yield* DomainIngestEngine,
          broadcast: yield* DomainBroadcast,
        };
      }),
    );

  return {
    run,
    getServerServices,
    appliedEventIds,
    sentIdsByUser,
  };
};

const waitUntil = async (predicate: () => boolean, timeoutMs = 2000, intervalMs = 20): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for condition");
};

const createClientRuntime = (options: {
  userId: string;
  offset: number;
  appliedEventIds: string[];
  persistedOffset: { value: number };
  localStore: Map<string, LocalEvent<DomainEvent>>;
  ingest: {
    ingest: (event: DomainEvent, meta: { initiatorId: string }) => Effect.Effect<void, unknown>;
  };
  broadcast: {
    subscribe: (userId: string, options?: { offset?: number }) => Stream.Stream<DomainEvent, unknown>;
  };
  applicator?: Partial<{
    verify: (event: DomainEvent) => Effect.Effect<void, ValidationError>;
    apply: (event: DomainEvent) => Effect.Effect<void, ApplicatorError>;
  }>;
}) => {
  const storageService: Storage<DomainEvent> = {
    getPendingEvents: Stream.fromIterable(
      [...options.localStore.values()].filter(
        (entry) => entry.status.local === "pending" || entry.status.remote === "pending",
      ),
    ),
    saveEvent: (event, status) =>
      Effect.gen(function* () {
        if (options.localStore.has(event.id)) {
          return yield* Effect.fail(new DuplicateEventError({ eventId: event.id }));
        }
        options.localStore.set(event.id, { event, status });
      }),
    updateEventStatus: (eventId, patch) =>
      Effect.gen(function* () {
        const existing = options.localStore.get(eventId);
        if (!existing) {
          return yield* Effect.fail(new StorageError({ cause: `Unknown event ${eventId}` }));
        }
        const nextStatus: LocalEventStatus = {
          ...existing.status,
          ...patch,
        };
        options.localStore.set(eventId, {
          ...existing,
          status: nextStatus,
        });
      }),
  };

  const transportService: Transport<DomainEvent> = {
    publish: (event) =>
      options.ingest
        .ingest(event, { initiatorId: options.userId })
        .pipe(
          Effect.mapError((error) =>
            typeof error === "object" && error !== null && "_tag" in error && error._tag === "DuplicateEventError"
              ? (error as DuplicateEventError)
              : new TransportError({ cause: error, isRetryable: false }),
          ),
        ),
    listen: (listenOptions) =>
      Effect.succeed(
        options.broadcast.subscribe(options.userId, listenOptions).pipe(
          Stream.tap(() =>
            Effect.sync(() => {
              options.persistedOffset.value += 1;
            }),
          ),
          Stream.mapError((error) => new TransportError({ cause: error, isRetryable: false })),
        ),
      ),
  };

  const defaultApplicatorService = {
    verify: (event: DomainEvent) =>
      isStudentScopedEvent(event) && event.data.studentId === options.userId
        ? Effect.void
        : Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" })),
    apply: (event: DomainEvent) =>
      Effect.sync(() => {
        options.appliedEventIds.push(event.id);
      }),
  };
  const applicatorService = {
    verify: options.applicator?.verify ?? defaultApplicatorService.verify,
    apply: options.applicator?.apply ?? defaultApplicatorService.apply,
  };

  const engineLayer = syncEngineLive(ClientSyncEngine, ClientApplicator, ClientStorage, ClientTransport, {
    offset: options.offset,
  }).pipe(
    Layer.provideMerge(Layer.succeed(ClientApplicator, applicatorService)),
    Layer.provideMerge(Layer.succeed(ClientStorage, storageService)),
    Layer.provideMerge(Layer.succeed(ClientTransport, transportService)),
  );

  return ManagedRuntime.make(engineLayer);
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

  it("rejects duplicate ingest reruns without duplicating apply or replay state", async () => {
    const harness = createHarness();
    const event = makeAbsenceRecordedEvent("77777777-7777-4777-8777-777777777777", STUDENT_A, COURSE_A, new Date(7));

    const result = await harness.run(
      Effect.gen(function* () {
        const ingest = yield* DomainIngestEngine;
        const broadcast = yield* DomainBroadcast;

        const firstIngest = yield* Effect.exit(ingest.ingest(event, { initiatorId: STUDENT_A }));
        const secondIngest = yield* Effect.exit(ingest.ingest(event, { initiatorId: STUDENT_A }));

        const replay = yield* Stream.runCollect(broadcast.subscribe(STUDENT_A, { offset: 0 }).pipe(Stream.take(1)));
        const duplicateReplayCheck = yield* Effect.race(
          Stream.runHead(broadcast.subscribe(STUDENT_A, { offset: 1 })).pipe(Effect.as("event" as const)),
          Effect.sleep("100 millis").pipe(Effect.as("timeout" as const)),
        );

        return {
          firstIngest,
          secondIngest,
          replay: Array.from(replay),
          duplicateReplayCheck,
        };
      }),
    );

    expect(Exit.isSuccess(result.firstIngest)).toBe(true);
    expect(Exit.isFailure(result.secondIngest)).toBe(true);
    expect(result.replay).toEqual([event]);
    expect(result.duplicateReplayCheck).toBe("timeout");
    expect(harness.appliedEventIds).toEqual([event.id]);
    expect(harness.sentIdsByUser.get(STUDENT_A)).toEqual([event.id]);
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

  it("client runtime reconnects from persisted offset without duplicate replay", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const localStore = new Map<string, LocalEvent<DomainEvent>>();
    const appliedEventIds: string[] = [];
    const persistedOffset = { value: 0 };

    const runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: persistedOffset.value,
      localStore,
      appliedEventIds,
      persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "absence.recorded",
          data: {
            studentId: STUDENT_A,
            date: new Date(10),
            reason: "Krank",
            courseIds: [COURSE_A],
          },
        });
      }),
    );

    await waitUntil(() => persistedOffset.value === 1);
    expect(appliedEventIds.length).toBe(1);
    await runtimeA.dispose();

    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: persistedOffset.value,
      localStore,
      appliedEventIds,
      persistedOffset,
      ingest,
      broadcast,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(appliedEventIds.length).toBe(1);
    expect(persistedOffset.value).toBe(1);

    await runtimeB.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "absence.recorded",
          data: {
            studentId: STUDENT_A,
            date: new Date(11),
            reason: "Arzt",
            courseIds: [COURSE_B],
          },
        });
      }),
    );

    await waitUntil(() => persistedOffset.value === 2);
    expect(appliedEventIds.length).toBe(2);
    await runtimeB.dispose();
  });

  it("replays missed events after simulated background/offline lifecycle transition", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    let runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "absence.recorded",
          data: {
            studentId: STUDENT_A,
            date: new Date(40),
            reason: "Krank",
            courseIds: [COURSE_A],
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    await runtimeA.dispose();

    await runtimeB.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "absence.recorded",
          data: {
            studentId: STUDENT_A,
            date: new Date(41),
            reason: "Arzt",
            courseIds: [COURSE_B],
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 2);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: runtimeAState.persistedOffset.value,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await waitUntil(() => runtimeAState.persistedOffset.value === 2);

    expect(runtimeAState.appliedEventIds.length).toBe(2);
    expect(new Set(runtimeAState.appliedEventIds).size).toBe(2);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("reconnect replay recovers via local snapshot fallback after missing dependency applicator error", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    let runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "absence.recorded",
          data: {
            studentId: STUDENT_A,
            date: new Date(50),
            reason: "Krank",
            courseIds: [COURSE_A],
          },
        });
      }),
    );

    await waitUntil(() => runtimeAState.persistedOffset.value === 1 && runtimeBState.persistedOffset.value === 1);
    await runtimeA.dispose();

    await runtimeB.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "absence.recorded",
          data: {
            studentId: STUDENT_A,
            date: new Date(51),
            reason: "Arzt",
            courseIds: [COURSE_B],
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 2);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    const sentBeforeReconnect = harness.sentIdsByUser.get(STUDENT_A) ?? [];
    expect(sentBeforeReconnect).toHaveLength(2);
    const [firstEventId, replayedEventId] = sentBeforeReconnect;
    if (!firstEventId || !replayedEventId) {
      throw new Error("Expected sent event ids before reconnect");
    }

    const fallbackTriggerCount = { value: 0 };
    const replayApplyAttempts = { value: 0 };
    const dependencyResolved = { value: false };

    runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: runtimeAState.persistedOffset.value,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
      applicator: {
        apply: (event: DomainEvent) => {
          if (event.id !== replayedEventId) {
            return Effect.sync(() => {
              runtimeAState.appliedEventIds.push(event.id);
            });
          }

          const applyWithDependency = () =>
            Effect.gen(function* () {
              replayApplyAttempts.value += 1;
              if (!dependencyResolved.value) {
                return yield* Effect.fail(
                  new ApplicatorError({
                    cause: {
                      type: "MISSING_DEPENDENCY",
                      dependency: "student",
                      studentId: STUDENT_A,
                    },
                  }),
                );
              }

              runtimeAState.appliedEventIds.push(event.id);
            });

          return applyWithDependency().pipe(
            Effect.catchTag("ApplicatorError", (error) => {
              const isMissingDependencyError =
                typeof error.cause === "object" &&
                error.cause !== null &&
                "type" in error.cause &&
                error.cause.type === "MISSING_DEPENDENCY";

              if (!isMissingDependencyError) {
                return Effect.fail(error);
              }

              return Effect.gen(function* () {
                fallbackTriggerCount.value += 1;
                dependencyResolved.value = true;
                yield* applyWithDependency();
              });
            }),
          );
        },
      },
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await waitUntil(
      () =>
        runtimeAState.persistedOffset.value === 2 &&
        runtimeAState.appliedEventIds.filter((eventId) => eventId === replayedEventId).length === 1,
    );

    expect(fallbackTriggerCount.value).toBe(1);
    expect(replayApplyAttempts.value).toBe(2);
    expect(runtimeAState.persistedOffset.value).toBe(2);
    expect(runtimeAState.appliedEventIds).toEqual([firstEventId, replayedEventId]);
    expect(new Set(runtimeAState.appliedEventIds).size).toBe(runtimeAState.appliedEventIds.length);
    expect(sentBeforeReconnect).toEqual([firstEventId, replayedEventId]);
    expect(new Set(sentBeforeReconnect).size).toBe(sentBeforeReconnect.length);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("replays missed grades.teacherApproved events after one device reconnects", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    let runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.teacherApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(60),
            course: COURSE_A,
            type: "WRITTEN",
            signature: "teacher-signature-1",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    await runtimeA.dispose();

    await runtimeB.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.teacherApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(61),
            course: COURSE_B,
            type: "WRITTEN",
            signature: "teacher-signature-2",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 2);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: runtimeAState.persistedOffset.value,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await waitUntil(() => runtimeAState.persistedOffset.value === 2);

    expect(runtimeAState.appliedEventIds.length).toBe(2);
    expect(runtimeBState.appliedEventIds.length).toBe(2);
    expect(new Set(runtimeAState.appliedEventIds).size).toBe(2);
    expect(new Set(runtimeBState.appliedEventIds).size).toBe(2);
    expect(runtimeAState.appliedEventIds).toEqual(runtimeBState.appliedEventIds);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("replays missed grades.parentApproved events after one device reconnects", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    let runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.parentApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(62),
            course: COURSE_A,
            type: "WRITTEN",
            signature: "parent-signature-1",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    await runtimeA.dispose();

    await runtimeB.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.parentApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(63),
            course: COURSE_B,
            type: "WRITTEN",
            signature: "parent-signature-2",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 2);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: runtimeAState.persistedOffset.value,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await waitUntil(() => runtimeAState.persistedOffset.value === 2);

    expect(runtimeAState.appliedEventIds.length).toBe(2);
    expect(runtimeBState.appliedEventIds.length).toBe(2);
    expect(new Set(runtimeAState.appliedEventIds).size).toBe(2);
    expect(new Set(runtimeBState.appliedEventIds).size).toBe(2);
    expect(runtimeAState.appliedEventIds).toEqual(runtimeBState.appliedEventIds);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("replays missed grades.latestRestored events after one device reconnects", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    let runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.latestRestored",
          data: {
            studentId: STUDENT_A,
            course: COURSE_A,
            type: "MASTER",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    await runtimeA.dispose();

    await runtimeB.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.latestRestored",
          data: {
            studentId: STUDENT_A,
            course: COURSE_B,
            type: "MASTER",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 2);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: runtimeAState.persistedOffset.value,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await waitUntil(() => runtimeAState.persistedOffset.value === 2);

    expect(runtimeAState.appliedEventIds.length).toBe(2);
    expect(runtimeBState.appliedEventIds.length).toBe(2);
    expect(new Set(runtimeAState.appliedEventIds).size).toBe(2);
    expect(new Set(runtimeBState.appliedEventIds).size).toBe(2);
    expect(runtimeAState.appliedEventIds).toEqual(runtimeBState.appliedEventIds);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("does not replay unauthorized grades.teacherApproved events after one device reconnects", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    let runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.teacherApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(70),
            course: COURSE_A,
            type: "WRITTEN",
            signature: "teacher-signature-1",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    await runtimeA.dispose();

    await expect(
      Effect.runPromise(
        ingest.ingest(
          {
            id: "77777777-7777-4777-8777-777777777777",
            timestamp: new Date(71),
            type: "grades.teacherApproved",
            data: {
              studentId: STUDENT_A,
              date: new Date(71),
              course: COURSE_B,
              type: "WRITTEN",
              signature: "teacher-signature-unauthorized",
            },
          },
          {
            initiatorId: STUDENT_B,
          },
        ),
      ),
    ).rejects.toThrow("ValidationError: NOT_ALLOWED");

    await runtimeB.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.teacherApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(72),
            course: COURSE_B,
            type: "WRITTEN",
            signature: "teacher-signature-2",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 2);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: runtimeAState.persistedOffset.value,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await waitUntil(() => runtimeAState.persistedOffset.value === 2);

    expect(runtimeAState.appliedEventIds.length).toBe(2);
    expect(runtimeBState.appliedEventIds.length).toBe(2);
    expect(new Set(runtimeAState.appliedEventIds).size).toBe(2);
    expect(new Set(runtimeBState.appliedEventIds).size).toBe(2);
    expect(runtimeAState.appliedEventIds).toEqual(runtimeBState.appliedEventIds);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("does not replay unauthorized grades.parentApproved events after one device reconnects", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    let runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.parentApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(73),
            course: COURSE_A,
            type: "WRITTEN",
            signature: "parent-signature-1",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    await runtimeA.dispose();

    await expect(
      Effect.runPromise(
        ingest.ingest(
          {
            id: "88888888-8888-4888-8888-888888888888",
            timestamp: new Date(74),
            type: "grades.parentApproved",
            data: {
              studentId: STUDENT_A,
              date: new Date(74),
              course: COURSE_B,
              type: "WRITTEN",
              signature: "parent-signature-unauthorized",
            },
          },
          {
            initiatorId: STUDENT_B,
          },
        ),
      ),
    ).rejects.toThrow("ValidationError: NOT_ALLOWED");

    await runtimeB.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.parentApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(75),
            course: COURSE_B,
            type: "WRITTEN",
            signature: "parent-signature-2",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 2);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: runtimeAState.persistedOffset.value,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await waitUntil(() => runtimeAState.persistedOffset.value === 2);

    expect(runtimeAState.appliedEventIds.length).toBe(2);
    expect(runtimeBState.appliedEventIds.length).toBe(2);
    expect(new Set(runtimeAState.appliedEventIds).size).toBe(2);
    expect(new Set(runtimeBState.appliedEventIds).size).toBe(2);
    expect(runtimeAState.appliedEventIds).toEqual(runtimeBState.appliedEventIds);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("does not replay unauthorized grades.latestRestored events after one device reconnects", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    let runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.latestRestored",
          data: {
            studentId: STUDENT_A,
            course: COURSE_A,
            type: "MASTER",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    await runtimeA.dispose();

    await expect(
      Effect.runPromise(
        ingest.ingest(
          {
            id: "99999999-9999-4999-8999-999999999999",
            timestamp: new Date(76),
            type: "grades.latestRestored",
            data: {
              studentId: STUDENT_A,
              course: COURSE_B,
              type: "MASTER",
            },
          },
          {
            initiatorId: STUDENT_B,
          },
        ),
      ),
    ).rejects.toThrow("ValidationError: NOT_ALLOWED");

    await runtimeB.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.latestRestored",
          data: {
            studentId: STUDENT_A,
            course: COURSE_B,
            type: "MASTER",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 2);
    expect(runtimeAState.persistedOffset.value).toBe(1);

    runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: runtimeAState.persistedOffset.value,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await waitUntil(() => runtimeAState.persistedOffset.value === 2);

    expect(runtimeAState.appliedEventIds.length).toBe(2);
    expect(runtimeBState.appliedEventIds.length).toBe(2);
    expect(new Set(runtimeAState.appliedEventIds).size).toBe(2);
    expect(new Set(runtimeBState.appliedEventIds).size).toBe(2);
    expect(runtimeAState.appliedEventIds).toEqual(runtimeBState.appliedEventIds);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("two live client runtimes converge for the same user", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    const runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "absence.recorded",
          data: {
            studentId: STUDENT_A,
            date: new Date(20),
            reason: "Krank",
            courseIds: [COURSE_A],
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);

    expect(runtimeAState.appliedEventIds.length).toBe(1);
    expect(runtimeBState.appliedEventIds.length).toBe(1);
    expect(runtimeAState.persistedOffset.value).toBe(1);
    expect(runtimeBState.persistedOffset.value).toBe(1);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("two live client runtimes converge for grades.currentGradeSet", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    const runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.currentGradeSet",
          data: {
            studentId: STUDENT_A,
            courseId: COURSE_A,
            date: new Date(30),
            result: 2.3,
            type: "MASTER",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);

    expect(runtimeAState.appliedEventIds.length).toBe(1);
    expect(runtimeBState.appliedEventIds.length).toBe(1);
    expect(runtimeAState.persistedOffset.value).toBe(1);
    expect(runtimeBState.persistedOffset.value).toBe(1);
    expect(runtimeAState.appliedEventIds[0]).toBe(runtimeBState.appliedEventIds[0]);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("two live client runtimes converge for grades.teacherApproved", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    const runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.teacherApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(50),
            course: COURSE_A,
            type: "WRITTEN",
            signature: "teacher-signature",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);

    expect(runtimeAState.appliedEventIds.length).toBe(1);
    expect(runtimeBState.appliedEventIds.length).toBe(1);
    expect(runtimeAState.persistedOffset.value).toBe(1);
    expect(runtimeBState.persistedOffset.value).toBe(1);
    expect(runtimeAState.appliedEventIds[0]).toBe(runtimeBState.appliedEventIds[0]);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("two live client runtimes converge for grades.parentApproved", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    const runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.parentApproved",
          data: {
            studentId: STUDENT_A,
            date: new Date(51),
            course: COURSE_A,
            type: "WRITTEN",
            signature: "parent-signature",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);

    expect(runtimeAState.appliedEventIds.length).toBe(1);
    expect(runtimeBState.appliedEventIds.length).toBe(1);
    expect(runtimeAState.persistedOffset.value).toBe(1);
    expect(runtimeBState.persistedOffset.value).toBe(1);
    expect(runtimeAState.appliedEventIds[0]).toBe(runtimeBState.appliedEventIds[0]);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("two live client runtimes converge for grades.latestRestored", async () => {
    const harness = createHarness();
    const { ingest, broadcast } = await harness.getServerServices();

    const runtimeAState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };
    const runtimeBState = {
      localStore: new Map<string, LocalEvent<DomainEvent>>(),
      appliedEventIds: [] as string[],
      persistedOffset: { value: 0 },
    };

    const runtimeA = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeAState.localStore,
      appliedEventIds: runtimeAState.appliedEventIds,
      persistedOffset: runtimeAState.persistedOffset,
      ingest,
      broadcast,
    });
    const runtimeB = createClientRuntime({
      userId: STUDENT_A,
      offset: 0,
      localStore: runtimeBState.localStore,
      appliedEventIds: runtimeBState.appliedEventIds,
      persistedOffset: runtimeBState.persistedOffset,
      ingest,
      broadcast,
    });

    await runtimeA.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );
    await runtimeB.runPromise(
      Effect.gen(function* () {
        yield* ClientSyncEngine;
      }),
    );

    await runtimeA.runPromise(
      Effect.gen(function* () {
        const engine = yield* ClientSyncEngine;
        yield* engine.ingest({
          type: "grades.latestRestored",
          data: {
            studentId: STUDENT_A,
            course: COURSE_A,
            type: "MASTER",
          },
        });
      }),
    );

    await waitUntil(() => runtimeBState.persistedOffset.value === 1);

    expect(runtimeAState.appliedEventIds.length).toBe(1);
    expect(runtimeBState.appliedEventIds.length).toBe(1);
    expect(runtimeAState.persistedOffset.value).toBe(1);
    expect(runtimeBState.persistedOffset.value).toBe(1);
    expect(runtimeAState.appliedEventIds[0]).toBe(runtimeBState.appliedEventIds[0]);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });
});
