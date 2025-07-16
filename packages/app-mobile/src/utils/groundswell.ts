import {
  ApplicatorError,
  syncEngineLive,
  ValidationError,
  type Applicator,
  type Storage,
  type SyncEngine,
  type Transport,
} from "@groundswell/core";
import { syncEngineFactory } from "@groundswell/react";
import { DomainEvent, EventName } from "@stu/lib";
import { Context, Data, Effect, Layer } from "effect";
import { applicators, Database } from "@stu/student";
import { ClientStorage } from "@groundswell/adapter-drizzle-sqlite";
import { createSseTransportLayer } from "@groundswell/adapter-sse-client";
import { ReactNativeEventSourceServiceLive } from "@groundswell/adapter-sse-client/react-native";
import {
  AbsenceRepository,
  GradeRepository,
  StudentRepository,
  SchoolRepository,
  PersonRepository,
  YearRepository,
  CourseRepository,
  TimetableRepository,
  HolidayRepository,
  SemesterRepository,
} from "@stu/student";
import { getStorage } from "./storage";
import { getBaseUrl } from "./base-url";

export class DomainApplicator extends Context.Tag("Applicator")<DomainApplicator, Applicator<DomainEvent>>() {}

export class DomainStorage extends Context.Tag("Storage")<DomainStorage, Storage<DomainEvent>>() {}

export class DomainTransport extends Context.Tag("Transport")<DomainTransport, Transport<DomainEvent>>() {}

export class DomainSyncEngine extends Context.Tag("SyncEngine")<DomainSyncEngine, SyncEngine<DomainEvent>>() {}

export const clientSyncEngine = syncEngineFactory(DomainSyncEngine, Database);

export class NoSessionError extends Data.TaggedError("NoSessionError") {}

const currentSession = Effect.gen(function* () {
  const session = getStorage("auth.session");
  if (!session) {
    return yield* Effect.fail(new NoSessionError());
  }
  return yield* Effect.succeed(session);
});

const repositories = Layer.mergeAll(
  AbsenceRepository.Default,
  GradeRepository.Default,
  SchoolRepository.Default,
  PersonRepository.Default,
  YearRepository.Default,
  CourseRepository.Default,
  TimetableRepository.Default,
  HolidayRepository.Default,
  SemesterRepository.Default,
  StudentRepository.Default,
);

const clientApplicatorsLive = Layer.effect(
  DomainApplicator,
  Effect.gen(function* () {
    const db = yield* Database;
    return DomainApplicator.of({
      verify: Effect.fn(
        function* (event: DomainEvent) {
          const session = yield* currentSession;

          return yield* applicators.verify(event, {
            initiatorId: session.user,
          });
        },
        Effect.provide(repositories),
        Effect.provideService(Database, db),
        Effect.catchTags({
          DatabaseError: (error) => Effect.fail(new ValidationError({ cause: error, reason: "UNKNOWN" })),
          ApplicatorError: (error) => Effect.fail(new ValidationError({ cause: error, reason: "UNKNOWN" })),
          NoSessionError: () => Effect.fail(new ValidationError({ cause: "No session", reason: "UNKNOWN" })),
        }),
      ),
      apply: Effect.fn(
        function* (event: DomainEvent) {
          const session = yield* currentSession;

          return yield* applicators.apply(event, {
            initiatorId: session.user,
          });
        },
        Effect.provide(repositories),
        Effect.provideService(Database, db),
        Effect.catchTags({
          DatabaseError: (error) => Effect.fail(new ApplicatorError({ cause: error })),
          NoSessionError: () => Effect.fail(new ApplicatorError({ cause: "No session" })),
        }),
      ),
    });
  }),
);

const StorageLive = ClientStorage.createDrizzleStorageLayer(DomainStorage, {
  db: Database,
  eventSchema: DomainEvent,
});

const TransportLive = createSseTransportLayer(DomainTransport, {
  baseUrl: `${getBaseUrl()}/api`,
  eventSchema: DomainEvent,
}).pipe(Layer.provide(ReactNativeEventSourceServiceLive));

export const SyncEngineLive = syncEngineLive(DomainSyncEngine, DomainApplicator, DomainStorage, DomainTransport).pipe(
  Layer.provide(clientApplicatorsLive),
  Layer.provide(StorageLive),
  Layer.provide(TransportLive),
);
