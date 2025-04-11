import { useEffect, useState } from "react";
import EventSource from "react-native-sse";
import superjson from "superjson";

import { deserializeEvent } from "@stu/lib";
import * as tables from "@stu/student/schema";

import type { LocalEvent } from "./ingest";
import { db } from "~/db/client";
import { getBaseUrl } from "../base-url";

const getEventStream = (sessionToken?: string) => {
  console.log("getting event stream", sessionToken);
  return new EventSource(`${getBaseUrl()}/events`, {
    headers: {
      "x-session": sessionToken
        ? {
            toString: function () {
              return sessionToken;
            },
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
      console.log("RECEIVED REMOTE EVENT >>>", e.data?.type);

      if (e.success) {
        // First: Save to local events table
        await db.insert(tables.events).values({
          type: e.data.type,
          id: e.data.id,
          data: superjson.stringify(e.data.data),
          timestamp: e.data.timestamp,
          localStatus: "pending",
          publishStatus: "success",
        });

        onEvent({
          event: e.data,
          metadata: {
            localStatus: "pending",
            publishStatus: "success",
          },
        });
      } else {
        console.error("Failed to parse event", e.error);
      }
    });

    return () => {
      eventStream.close();
    };
  }, [sessionToken, retries, onEvent]);
};
