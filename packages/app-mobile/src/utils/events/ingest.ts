import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { asc, eq, or } from "drizzle-orm";
import * as Crypto from "expo-crypto";
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
import { publishEvent } from "../api";
import { useMutationStore } from "./mutation-manager";

type ExpoPersistedEvent = Omit<Event, "errors"> & {};
interface EventMetadata {
  localStatus: "pending" | "error" | "success";
  publishStatus: "pending" | "error" | "success";
}

// Ingest is for locally occuring events. They are stored locally,
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
    // isAppliedLocally: false,
    // isPublished: localOnly,
    // isFailed: false,
    publishStatus: localOnly ? "success" : "pending",
    localStatus: "pending",
  });

  const result = await ingestExistingEvent<TEventName>(
    eventDataWithName.id,
    userId,
  );

  useMutationStore.getState().push({
    event: eventDataWithName,
    metadata: {
      localStatus: "pending",
      publishStatus: Result.isOk(result) ? "success" : "error",
    },
  });

  return result;
};

export interface LocalEvent {
  event: ExpoPersistedEvent;
  metadata: EventMetadata;
}

const parseLocalEvent = (
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
      localStatus: row.localStatus,
      publishStatus: row.publishStatus,
    },
  };
};

export const getEventsToBePushed = async () => {
  const rows = await db
    .select()
    .from(tables.events)
    .where(
      or(
        eq(tables.events.localStatus, "pending"),
        eq(tables.events.publishStatus, "pending"),
      ),
    )
    .orderBy(asc(tables.events.timestamp));

  return rows.map(parseLocalEvent).filter((mut) => mut !== undefined);
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

// Apply an event that is already in the local event log
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

  // Second: Verify locally
  let error = (await applicator.verify(event, {
    initiatorUserId: userId,
  })) as EventErrorsByName<TEventName> | undefined;
  if (error) {
    console.log("error verifying event", error);
    console.log("metadata", metadata);
    if (metadata.publishStatus === "success") {
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
  console.log(`Applying a ${event.type} event locally. ID: ${event.id}`);
  try {
    await applicator.apply(event);
  } catch (e) {
    console.error(`Error while applying:`, e);
    return Result.err("UNEXPECTED" as const);
  }
  await db
    .update(tables.events)
    .set({ localStatus: "success" })
    .where(eq(tables.events.id, event.id));

  return Result.ok(undefined);
};

// useIngest is used to ingest locally ocurring events
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

const useIngestMutation = <TEventName extends EventName>(
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
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      if (Result.isErr(result)) throw result.error;
    },
  });
