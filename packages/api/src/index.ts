import { AuthRepository } from "@stu/lib";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { Effect } from "effect";
import { DomainCanonicalStorage, DomainServerApplicator } from "./boilerplate";
import { SYSTEM_USER } from "./constants";
import { runtime } from "./groundswell";
import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { ingest, ingestEffect } from "./services/sync-service";
import { createCallerFactory, createTRPCContext } from "./trpc";

const createCaller = createCallerFactory(appRouter);

type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { createTRPCContext, appRouter, createCaller, ingest, ingestEffect, SYSTEM_USER };
export type { AppRouter, RouterInputs, RouterOutputs };
export { createBase } from "./base";

const sendMissingEventsToUser = Effect.fn(function* (userId: string) {
  const canonicalStorage = yield* DomainCanonicalStorage;
  const serverApplicator = yield* DomainServerApplicator;

  const topics = yield* serverApplicator.getUserTopics(userId);
  const missingEvents = yield* canonicalStorage.getMissingEventsForUser(userId, topics);
  yield* Effect.all(
    missingEvents.map((event) => canonicalStorage.markEventAsSentToUser(event.id, userId)),
    {
      concurrency: "unbounded",
    },
  );
});

const bootstrapBroadcast = Effect.gen(function* () {
  const authRepository = yield* AuthRepository;
  const users = yield* authRepository.getAllUsers();
  yield* Effect.all(
    users.map((user) => sendMissingEventsToUser(user.id)),
    {
      concurrency: "unbounded",
    },
  );
});

export const bootstrapBroadcastAsync = () => runtime.runPromise(bootstrapBroadcast);
