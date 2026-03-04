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
import { DomainEvent as DomainEventSchema } from "@stu/lib";
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
import { Data, Effect, Layer, Logger, ManagedRuntime, ServiceMap, Stream } from "effect";
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
import type { ZodSchema } from "zod";
import type { DomainEvent } from "../../../student/src/domain-event";

export class DomainApplicator extends ServiceMap.Service<DomainApplicator, Applicator<DomainEvent>>()("Applicator") {}

export class DomainStorage extends ServiceMap.Service<DomainStorage, Storage<DomainEvent>>()("Storage") {}

export class DomainTransport extends ServiceMap.Service<DomainTransport, Transport<DomainEvent>>()("Transport") {}

export class DomainSyncEngine extends ServiceMap.Service<DomainSyncEngine, SyncEngine<DomainEvent>>()("SyncEngine") {}

interface SessionService {
  readonly current: Effect.Effect<{ user: string; token: string }, NoSessionError>;
}

export class DomainSession extends ServiceMap.Service<DomainSession, SessionService>()("Session") {}

export const clientSyncEngine = syncEngineFactory(DomainSyncEngine, Database as any);

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

const SessionLive = Layer.succeed(
  DomainSession,
  DomainSession.of({
    current: Effect.gen(function* () {
      const session = getStorage("auth.session");
      if (!session) {
        return yield* Effect.fail(new NoSessionError());
      }
      return session;
    }),
  }),
);

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
    const sessionService = yield* DomainSession;
    return DomainApplicator.of({
      verify: (event: DomainEvent) =>
        Effect.gen(function* () {
          const session = yield* sessionService.current;

          yield* applicators
            .verify(event, {
              initiatorId: session.user,
            })
            .pipe(
              Effect.catchIf(
                (error): error is ValidationError => error instanceof ValidationError,
                (error) =>
                  shouldBypassLocalMissingDependencyVerification(event, error) ? Effect.void : Effect.fail(error),
              ),
            );
        }).pipe(
          Effect.provide(repositories),
          Effect.provideService(Database, db),
          Effect.catchTags({
            DatabaseError: (error: unknown) => Effect.fail(new ValidationError({ cause: error, reason: "UNKNOWN" })),
            ApplicatorError: (error: unknown) => Effect.fail(new ValidationError({ cause: error, reason: "UNKNOWN" })),
            NoSessionError: () => Effect.fail(new ValidationError({ cause: "No session", reason: "UNKNOWN" })),
          }),
        ) as Effect.Effect<void, ValidationError>,
      apply: (event: DomainEvent) =>
        Effect.gen(function* () {
          const session = yield* sessionService.current;

          return yield* applyEventWithSnapshotRecovery({
            event,
            applyEvent: (candidate) =>
              applicators.apply(candidate, {
                initiatorId: session.user,
              }) as Effect.Effect<void, ApplicatorError | import("@stu/lib").UnknownDatabaseError>,
            fetchSnapshot: (request) => fetchSnapshotFromDefaultApi({ request }),
            applySnapshot: applySnapshotToLocalDatabase,
          });
        }).pipe(
          Effect.provide(repositories),
          Effect.provideService(Database, db),
          Effect.catchTags({
            DatabaseError: (error: unknown) => Effect.fail(new ApplicatorError({ cause: error })),
            SnapshotRecoveryError: (error: SnapshotRecoveryError) => Effect.fail(new ApplicatorError({ cause: error })),
            NoSessionError: () => Effect.fail(new ApplicatorError({ cause: "No session" })),
          }),
        ) as Effect.Effect<void, ApplicatorError>,
    });
  }),
);

const StorageLive = ClientStorage.createDrizzleStorageLayer(DomainStorage, {
  db: Database as any,
  eventSchema: DomainEventSchema as unknown as ZodSchema<DomainEvent>,
});

const TransportLive = createSseTransportLayer(DomainTransport, {
  baseUrl: `${getBaseUrl()}/api`,
  eventSchema: DomainEventSchema as unknown as ZodSchema<DomainEvent>,
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
    Layer.provide(SessionLive),
    Layer.provide(StorageLive),
    Layer.provide(TransportWithOffsetPersistenceLive),
    Layer.merge(RandomUUIDLive),
  );

export const makeRuntime = (offset: number) =>
  ManagedRuntime.make(
    Layer.mergeAll(makeSyncEngineLive(offset), repositories).pipe(
      Layer.provideMerge(DatabaseLive),
      Layer.merge(Logger.layer([Logger.consolePretty()])),
    ) as never,
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
