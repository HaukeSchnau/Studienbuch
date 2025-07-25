import { ClientStorage } from "@groundswell/adapter-drizzle-sqlite";
import { ReactNativeEventSourceServiceLive } from "@groundswell/adapter-sse-client/react-native";
import {
  type Applicator,
  ApplicatorError,
  RandomUUID,
  type Storage,
  type SyncEngine,
  syncEngineLive,
  type Transport,
  ValidationError,
} from "@groundswell/core";
import { syncEngineFactory } from "@groundswell/react";
import { DomainEvent } from "@stu/lib";
import {
  AbsenceRepositoryLive,
  applicators,
  ClassRepositoryLive,
  CourseRepositoryLive,
  Database,
  GradeRepositoryLive,
  HolidayRepositoryLive,
  PersonRepositoryLive,
  SchoolRepositoryLive,
  SemesterRepositoryLive,
  StudentRepositoryLive,
  TimetableRepositoryLive,
  YearRepositoryLive,
} from "@stu/student";
import { Context, Data, Effect, Layer } from "effect";
import * as Crypto from "expo-crypto";
import { getBaseUrl } from "./base-url";
import { getStorage } from "./storage";
import { createSseTransportLayer } from "./transport";

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
  AbsenceRepositoryLive,
  GradeRepositoryLive,
  SchoolRepositoryLive,
  PersonRepositoryLive,
  YearRepositoryLive,
  CourseRepositoryLive,
  TimetableRepositoryLive,
  HolidayRepositoryLive,
  SemesterRepositoryLive,
  StudentRepositoryLive,
  ClassRepositoryLive,
);

const clientApplicatorsLive = Layer.effect(
  DomainApplicator,
  Effect.gen(function* () {
    const db = yield* Database;
    return DomainApplicator.of({
      verify: Effect.fn(
        function* (event: DomainEvent) {
          const session = yield* currentSession;

          const thing = applicators.verify(event, {
            initiatorId: session.user,
          });
          console.log("thing", thing);
          console.log(
            "applicators",
            applicators.verify(event, {
              initiatorId: session.user,
            }),
          );
          yield* applicators.verify(event, {
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

const RandomUUIDLive = Layer.succeed(RandomUUID, {
  next: Effect.sync(() => Crypto.randomUUID()),
});

export const SyncEngineLive = syncEngineLive(DomainSyncEngine, DomainApplicator, DomainStorage, DomainTransport).pipe(
  Layer.provide(clientApplicatorsLive),
  Layer.provide(StorageLive),
  Layer.provide(TransportLive),
  Layer.merge(RandomUUIDLive),
);
