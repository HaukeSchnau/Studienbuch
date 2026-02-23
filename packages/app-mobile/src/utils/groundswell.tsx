import { ClientStorage } from "@groundswell/adapter-drizzle-sqlite";
import { createSseTransportLayer } from "@groundswell/adapter-sse-client";
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
import { Context, Data, Effect, Layer, Logger, ManagedRuntime, Stream } from "effect";
import * as Crypto from "expo-crypto";
import React, { useContext } from "react";
import { DatabaseLive } from "~/db/client";
import { getHeadersObject } from "./api";
import { getBaseUrl } from "./base-url";
import {
  applyEventWithSnapshotRecovery,
  applySnapshotToLocalDatabase,
  fetchSnapshotFromDefaultApi,
  type SnapshotRecoveryError,
} from "./snapshot-recovery";
import { getStorage, setStorage } from "./storage";

export class DomainApplicator extends Context.Tag("Applicator")<DomainApplicator, Applicator<DomainEvent>>() {}

export class DomainStorage extends Context.Tag("Storage")<DomainStorage, Storage<DomainEvent>>() {}

export class DomainTransport extends Context.Tag("Transport")<DomainTransport, Transport<DomainEvent>>() {}

export class DomainSyncEngine extends Context.Tag("SyncEngine")<DomainSyncEngine, SyncEngine<DomainEvent>>() {}

export const clientSyncEngine = syncEngineFactory(DomainSyncEngine, Database);

export class NoSessionError extends Data.TaggedError("NoSessionError") {}

const shouldBypassLocalMissingDependencyVerification = (event: DomainEvent, error: ValidationError) => {
  if (error.reason !== "NOT_FOUND") {
    return false;
  }

  if (event.type === "student.joined") {
    return error.cause === "INVALID_CLASS";
  }

  if (event.type === "student.courseAssigned") {
    return error.cause === "INVALID_COURSE";
  }

  return false;
};

const currentSession = Effect.gen(function* () {
  const session = getStorage("auth.session");
  if (!session) {
    return yield* Effect.fail(new NoSessionError());
  }
  return yield* Effect.succeed(session);
});

export const repositories = Layer.mergeAll(
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

          yield* applicators
            .verify(event, {
              initiatorId: session.user,
            })
            .pipe(
              Effect.catchTag("ValidationError", (error) =>
                shouldBypassLocalMissingDependencyVerification(event, error) ? Effect.void : Effect.fail(error),
              ),
            );
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

          return yield* applyEventWithSnapshotRecovery({
            event,
            applyEvent: (candidate) =>
              applicators.apply(candidate, {
                initiatorId: session.user,
              }),
            fetchSnapshot: (request) => fetchSnapshotFromDefaultApi({ request }),
            applySnapshot: applySnapshotToLocalDatabase,
          });
        },
        Effect.provide(repositories),
        Effect.provideService(Database, db),
        Effect.catchTags({
          DatabaseError: (error) => Effect.fail(new ApplicatorError({ cause: error })),
          SnapshotRecoveryError: (error: SnapshotRecoveryError) => Effect.fail(new ApplicatorError({ cause: error })),
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
  headers: getHeadersObject,
}).pipe(Layer.provide(ReactNativeEventSourceServiceLive));

const TransportWithOffsetPersistenceLive = Layer.effect(
  DomainTransport,
  Effect.gen(function* () {
    const transport = yield* DomainTransport;

    return DomainTransport.of({
      publish: transport.publish,
      listen: (options) =>
        Effect.gen(function* () {
          let offset = options?.offset ?? 0;
          const stream = yield* transport.listen(options);
          return stream.pipe(
            Stream.tap(() =>
              Effect.promise(async () => {
                offset += 1;
                await setStorage("sync.offset", offset);
              }),
            ),
          );
        }),
    });
  }),
).pipe(Layer.provide(TransportLive));

// Cannot use the default layer because it uses crypto.randomUUID() which is not available in the Expo environment.
const RandomUUIDLive = Layer.succeed(RandomUUID, {
  next: Effect.sync(() => Crypto.randomUUID()),
});

export const makeSyncEngineLive = (offset: number) =>
  syncEngineLive(DomainSyncEngine, DomainApplicator, DomainStorage, DomainTransport, { offset }).pipe(
    Layer.provide(clientApplicatorsLive),
    Layer.provide(StorageLive),
    Layer.provide(TransportWithOffsetPersistenceLive),
    Layer.merge(RandomUUIDLive),
  );

export const makeRuntime = (offset: number) =>
  ManagedRuntime.make(
    Layer.mergeAll(makeSyncEngineLive(offset), repositories).pipe(
      Layer.provideMerge(DatabaseLive),
      Layer.merge(Logger.pretty),
    ),
  );

export type AppRuntime = Awaited<ReturnType<typeof makeRuntime>>;
export const RuntimeContext = React.createContext<AppRuntime | null>(null);
export const useRuntime = () => {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error("useRuntime has to be used within a RuntimeContext");
  }
  return runtime;
};
