import type { UseMutationOptions } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useMutation } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import superjson from "superjson";

import type {
  EventApplicatorInterface,
  EventDataByName,
  EventErrorsByName,
  EventName,
} from "@stu/lib";
import { Event, Result } from "@stu/lib";
import { EventApplicator } from "@stu/student";
import * as tables from "@stu/student/schema";

import { db } from "~/db/client";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { publishEvent } from "./api";

type ExpoPersistedEvent = Omit<Event, "errors"> & {};
interface EventMetadata {
  isFailed: boolean;
  isPublished: boolean;
  isAppliedLocally: boolean;
}

export const ingest = async <TEventName extends EventName>(
  eventName: TEventName,
  userId: string,
  data: EventDataByName<TEventName>,
  localOnly = false,
): Promise<Result<undefined, EventErrorsByName<TEventName>>> => {
  const eventDataWithName = {
    data,
    type: eventName,
    timestamp: new Date(),
    id: Crypto.randomUUID(),
  } satisfies Omit<Event, "errors"> as Omit<
    Extract<Event, { type: TEventName }>,
    "errors"
  >;

  // First: Save to local events table
  await db.insert(tables.events).values({
    type: eventName,
    id: eventDataWithName.id,
    data: superjson.stringify(eventDataWithName.data),
    timestamp: eventDataWithName.timestamp,
    isAppliedLocally: false,
    isPublished: localOnly,
    isFailed: false,
  });

  return ingestExistingEvent<TEventName>(eventDataWithName.id, userId);
};

export const ingestRemoteEvent = async <TEventName extends EventName>(
  eventName: TEventName,
  userId: string,
  data: EventDataByName<TEventName>,
  timestamp: Date,
  id: string,
) => {
  const eventDataWithName = {
    data,
    type: eventName,
    timestamp,
    id,
  } satisfies Omit<Event, "errors"> as Omit<
    Extract<Event, { type: TEventName }>,
    "errors"
  >;

  // First: Save to local events table
  await db.insert(tables.events).values({
    type: eventName,
    id: eventDataWithName.id,
    data: superjson.stringify(eventDataWithName.data),
    timestamp: eventDataWithName.timestamp,
    isAppliedLocally: false,
    isPublished: true,
    isFailed: false,
  });

  return ingestExistingEvent<TEventName>(eventDataWithName.id, userId);
};

export interface LocalEvent {
  event: ExpoPersistedEvent;
  metadata: EventMetadata;
}

export const parseLocalEvent = (
  row: typeof tables.events.$inferSelect,
): LocalEvent | undefined => {
  const event = Event.safeParse({
    ...row,
    data: superjson.parse(row.data),
  });

  if (!event.success) {
    console.error("error parsing event", row, event.error);
    return undefined;
  }

  return {
    event: event.data,
    metadata: {
      isPublished: row.isPublished,
      isAppliedLocally: row.isAppliedLocally,
      isFailed: row.isFailed,
    },
  };
};

const getEventFromDb = async (id: string): Promise<LocalEvent | undefined> => {
  const [row] = await db
    .select()
    .from(tables.events)
    .where(eq(tables.events.id, id));
  if (!row) {
    return undefined;
  }

  return parseLocalEvent(row);
};

export const ingestExistingEvent = async <TEventName extends EventName>(
  id: string,
  userId: string,
) => {
  const data = await getEventFromDb(id);
  if (!data) {
    console.warn("event not found in db", id);
    return Result.ok(undefined);
  }
  const { event, metadata } = data;
  const applicator: EventApplicatorInterface = new EventApplicator(db, userId);

  console.log("verifying event", event);

  // Second: Verify locally
  let error = (await applicator.verify(event, {
    initiatorUserId: userId,
  })) as EventErrorsByName<TEventName> | undefined;
  if (error) {
    console.log("error verifying event", error);
    console.log("metadata", metadata);
    if (metadata.isPublished) {
      return Result.err(error);
    }

    // The error may be due to missing events, so first, we want to try to publish the event
    // in order to get the missing events, and then verify again. If it still fails, we return the error
    // as it's not possible to apply the event locally without the missing events
    const res = await publishEvent(event);
    if (Result.isErr(res) && res.error !== "CONFLICT") {
      console.warn(
        "error publishing event while trying to receive additional events",
        event,
        res,
      );
      return Result.err(error);
    }

    error = (await applicator.verify(event, {
      initiatorUserId: userId,
    })) as EventErrorsByName<TEventName> | undefined;
    if (error) {
      return Result.err(error);
    }
  }

  // Third: Apply locally
  await applicator.apply(event);
  await db
    .update(tables.events)
    .set({ isAppliedLocally: true })
    .where(eq(tables.events.id, event.id));

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
