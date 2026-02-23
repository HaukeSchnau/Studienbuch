import type { ApplicatorError } from "@groundswell/core";
import {
  type DomainEvent,
  type SnapshotRequest,
  type SnapshotResponse,
  SnapshotResponseSchema,
  snapshotEntitiesForEvent,
  type UnknownDatabaseError,
} from "@stu/lib";
import { applySnapshotToLocalDatabase as applySnapshotToLocalDatabaseFromStudent } from "@stu/student";
import { Data, Effect, Either } from "effect";
import { getHeadersObject } from "./request-headers";

type BaseUrlModule = typeof import("./base-url");

declare const require: (path: string) => unknown;

const getBaseUrl = () => (require("./base-url") as BaseUrlModule).getBaseUrl();

export class SnapshotRecoveryError extends Data.TaggedError("SnapshotRecoveryError")<{
  cause: unknown;
}> {}

const isMissingReferenceError = (event: DomainEvent, error: UnknownDatabaseError | ApplicatorError): boolean => {
  if (error._tag === "DatabaseError") {
    return error.type === "foreign_key_violation";
  }

  if (
    error._tag === "ApplicatorError" &&
    "studentId" in event.data &&
    typeof event.data.studentId === "string" &&
    typeof error.cause === "string"
  ) {
    return error.cause === `Student ${event.data.studentId} not found`;
  }

  return false;
};

export const applySnapshotToLocalDatabase = applySnapshotToLocalDatabaseFromStudent;

export const fetchSnapshotFromApi = Effect.fn(function* (options: {
  baseUrl: string;
  headers: Record<string, string>;
  request: SnapshotRequest;
  fetchFn?: typeof fetch;
}) {
  const fetchFn = options.fetchFn ?? fetch;

  const response = yield* Effect.tryPromise({
    try: () =>
      fetchFn(`${options.baseUrl}/api/snapshot`, {
        method: "POST",
        headers: {
          ...options.headers,
          "content-type": "application/json",
        },
        body: JSON.stringify(options.request),
      }),
    catch: (cause) => new SnapshotRecoveryError({ cause }),
  });

  if (!response.ok) {
    return yield* Effect.fail(
      new SnapshotRecoveryError({
        cause: `Snapshot request failed with status ${response.status}`,
      }),
    );
  }

  const body = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => new SnapshotRecoveryError({ cause }),
  });

  const snapshot = SnapshotResponseSchema.safeParse(body);
  if (!snapshot.success) {
    return yield* Effect.fail(new SnapshotRecoveryError({ cause: snapshot.error }));
  }

  return snapshot.data;
});

export const fetchSnapshotFromDefaultApi = Effect.fn(function* (options: {
  request: SnapshotRequest;
  fetchFn?: typeof fetch;
}) {
  return yield* fetchSnapshotFromApi({
    baseUrl: getBaseUrl(),
    headers: getHeadersObject(),
    request: options.request,
    fetchFn: options.fetchFn,
  });
});

export const applyEventWithSnapshotRecovery = <RApply, RFetch, RApplySnapshot>(options: {
  event: DomainEvent;
  applyEvent: (event: DomainEvent) => Effect.Effect<void, UnknownDatabaseError | ApplicatorError, RApply>;
  fetchSnapshot: (request: SnapshotRequest) => Effect.Effect<SnapshotResponse, SnapshotRecoveryError, RFetch>;
  applySnapshot: (snapshot: SnapshotResponse) => Effect.Effect<void, UnknownDatabaseError, RApplySnapshot>;
}) =>
  Effect.gen(function* () {
    const initialResult = yield* options.applyEvent(options.event).pipe(Effect.either);
    if (Either.isRight(initialResult)) {
      return;
    }

    const error = initialResult.left;
    if (!isMissingReferenceError(options.event, error)) {
      return yield* Effect.fail(error);
    }

    const entities = snapshotEntitiesForEvent(options.event);
    if (entities.length === 0) {
      return yield* Effect.fail(error);
    }

    const snapshot = yield* options.fetchSnapshot({
      entities,
    });

    yield* options.applySnapshot(snapshot);

    return yield* options.applyEvent(options.event);
  });

export const hydrateSnapshotFromApi = Effect.fn(function* (options: {
  baseUrl: string;
  headers: Record<string, string>;
  request: SnapshotRequest;
  fetchFn?: typeof fetch;
}) {
  const snapshot = yield* fetchSnapshotFromApi(options);
  yield* applySnapshotToLocalDatabase(snapshot);
  return snapshot;
});

export const hydrateSnapshotFromDefaultApi = Effect.fn(function* (options: {
  request: SnapshotRequest;
  fetchFn?: typeof fetch;
}) {
  return yield* hydrateSnapshotFromApi({
    baseUrl: getBaseUrl(),
    headers: getHeadersObject(),
    request: options.request,
    fetchFn: options.fetchFn,
  });
});
