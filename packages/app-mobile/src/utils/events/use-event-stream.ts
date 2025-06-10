import { useEffect, useState } from "react";
import EventSource from "react-native-sse";
import superjson from "superjson";

import { deserializeEvent } from "@stu/lib";
import * as tables from "@stu/student/schema";

import { db } from "~/db/client";
import { getBaseUrl } from "../base-url";
import type { LocalEvent } from "./ingest";

const getEventStream = (sessionToken?: string) => {
  console.log("getting event stream", sessionToken);
  return new EventSource(`${getBaseUrl()}/events`, {
    headers: {
      "x-session": sessionToken
        ? {
            toString: () => sessionToken,
          }
        : undefined,
    },
  });
};

interface UseEventStreamOptions {
  sessionToken: string | undefined;
  onEvent: (event: LocalEvent) => void;
}

export const useRemoteEventStream = ({
  sessionToken,
  onEvent,
}: UseEventStreamOptions) => {
  const [retries, setRetries] = useState(0);
  useEffect(() => {
    if (!sessionToken) return;
    const eventStream = getEventStream(sessionToken);
    eventStream.addEventListener("error", (event) => {
      console.error("Error in event stream", event, "Retries:", retries);
      setRetries((r) => r + 1);
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    eventStream.addEventListener("message", async (event) => {
      if (!event.data) {
        console.error("no data in event", event);
        return;
      }
      const e = deserializeEvent(event.data);
      if (!e.success) {
        console.error(
          "Failed to parse event. Error: ",
          e.error,
          "Event: ",
          event.data,
        );
        return;
      }

      console.log("RECEIVED REMOTE EVENT >>>", e.data.type);

      // First: Save to local events table
      const [row] = await db
        .insert(tables.events)
        .values({
          type: e.data.type,
          id: e.data.id,
          data: superjson.stringify(e.data.data),
          timestamp: e.data.timestamp,
          localStatus: "pending",
          publishStatus: "success",
        })
        .onConflictDoUpdate({
          target: [tables.events.id],
          set: {
            publishStatus: "success",
          },
        })
        .returning();

      onEvent({
        event: e.data,
        metadata: {
          localStatus: row?.localStatus ?? "pending",
          publishStatus: row?.publishStatus ?? "success",
        },
      });
    });

    return () => eventStream.close();
  }, [sessionToken, retries, onEvent]);
};
