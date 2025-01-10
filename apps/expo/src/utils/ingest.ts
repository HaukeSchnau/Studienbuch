import type { UseMutationOptions } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useMutation } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import superjson from "superjson";

import type {
  Event,
  EventApplicatorInterface,
  EventDataByName,
  EventErrorsByName,
  EventName,
} from "@stu/lib";
import { Result } from "@stu/lib";
import { EventApplicator } from "@stu/student";
import * as tables from "@stu/student/schema";

import { db } from "~/db/client";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { publishEvent } from "./api";

export const ingest = async <TEventName extends EventName>(
  eventName: TEventName,
  userId: string,
  data: EventDataByName<TEventName>,
  connectionRequired?: boolean,
): Promise<Result<undefined, EventErrorsByName<TEventName>>> => {
  const applicator: EventApplicatorInterface = new EventApplicator(db, userId);
  const eventDataWithName = {
    data,
    type: eventName,
    timestamp: new Date(),
    id: Crypto.randomUUID(),
  } satisfies Omit<Event, "errors"> as Omit<
    Extract<Event, { type: TEventName }>,
    "errors"
  >;

  // Zeroth: Verify locally
  const error = await applicator.verify(eventDataWithName, {
    initiatorUserId: userId,
  });
  if (error) {
    return Result.err(error as EventErrorsByName<TEventName>);
  }

  // First: Save to local events table
  await db.insert(tables.events).values({
    type: eventName,
    id: eventDataWithName.id,
    data: superjson.stringify(eventDataWithName.data),
    timestamp: eventDataWithName.timestamp,
    status: "PENDING",
  });

  // Second: Apply locally
  await applicator.apply(eventDataWithName);
  await db
    .update(tables.events)
    .set({ status: "APPLIED" })
    .where(eq(tables.events.id, eventDataWithName.id));

  // Commented out because it's done in the background
  // // Third: Publish to API
  // try {
  //   await publishEvent(eventDataWithName);
  //   await db
  //     .update(tables.events)
  //     .set({ status: "PUBLISHED" })
  //     .where(eq(tables.events.id, eventDataWithName.id));
  // } catch (e) {
  //   console.warn("fetch failed", e);

  //   if (connectionRequired) {
  //     throw e;
  //   }
  // }

  return Result.ok(undefined);
};

export const useIngest = <TEventName extends EventName>(
  eventName: TEventName,
  options?: Omit<
    UseMutationOptions<
      void,
      EventErrorsByName<TEventName>,
      EventDataByName<TEventName>,
      unknown
    >,
    "mutationFn"
  >,
  connectionRequired?: boolean,
) => {
  const { userId } = useRequiredAuthenticatedSession();

  return useIngestMutation(eventName, userId, options, connectionRequired);
};

export const useIngestMutation = <TEventName extends EventName>(
  eventName: TEventName,
  userId: string,
  options?: Omit<
    UseMutationOptions<
      void,
      EventErrorsByName<TEventName>,
      EventDataByName<TEventName>,
      unknown
    >,
    "mutationFn"
  >,
  connectionRequired?: boolean,
) =>
  useMutation<
    void,
    EventErrorsByName<TEventName>,
    EventDataByName<TEventName>,
    unknown
  >({
    ...options,
    mutationFn: async (data) => {
      const result = await ingest(eventName, userId, data, connectionRequired);
      if (Result.isErr(result)) throw result.error;
    },
  });
