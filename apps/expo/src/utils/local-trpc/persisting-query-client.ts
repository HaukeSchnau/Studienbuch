import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { create } from "zustand";

import { deserializeEvent, Result } from "@stu/lib";
import * as tables from "@stu/student/schema";

import type { LocalEvent } from "../ingest";
import { db } from "~/db/client";
import { getEventStream, publishEvent } from "../api";
import { getEventsToBePushed, ingestExistingEvent } from "../ingest";
import { useStorage } from "../storage";

interface MutationStore {
  queue: LocalEvent[];
  initialize: (muts: LocalEvent[]) => void;
  push: (mutation: LocalEvent) => void;
  pop: () => void;
}

const useMutationStore = create<MutationStore>((set) => ({
  queue: [],
  initialize: (muts) => set({ queue: muts }),
  push: (mut) => set((state) => ({ queue: [...state.queue, mut] })),
  pop: () => set((state) => ({ queue: state.queue.slice(1) })),
}));

export const MutationManager = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const initialize = useMutationStore((state) => state.initialize);
  const head = useMutationStore((state) => state.queue[0]);
  const pop = useMutationStore((state) => state.pop);
  const push = useMutationStore((state) => state.push);

  const [session] = useStorage("auth.session");
  const sessionToken = session?.token;

  useEffect(() => {
    console.log("initializing local events");

    // Initialize the queue with events that are not done yet
    getEventsToBePushed()
      .then((muts) => {
        console.log("initialized", muts);
        initialize(muts);
      })
      .catch((reason) =>
        console.error("error while finding mutations", reason),
      );
  }, []);

  useEffect(() => {
    // Subscribe to rabbitmq events
    if (!sessionToken) return;
    const eventStream = getEventStream(sessionToken);
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

        push({
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
  }, [sessionToken]);

  const handleMutation = useMutation({
    retry: true,
    onError: (error, { event }) => {
      console.error(
        `Event ${event.id}: Error while handling. Will retry. Error: ${error}`,
      );
    },
    mutationFn: async ({ event, metadata }: LocalEvent) => {
      console.log(`Event ${event.id}: Starting to handle`);

      if (!session?.user) {
        console.warn(`Event ${event.id}: No user in session`);
        throw new Error("NO_USER_IN_SESSION");
      }

      if (metadata.localStatus === "pending") {
        const res = await ingestExistingEvent(event.id, session.user);
        if (Result.isErr(res)) {
          console.error(
            `Event ${event.id}: Failed to handle locally. Error: ${res.error}`,
          );
          await db
            .update(tables.events)
            .set({
              localStatus: "error",
            })
            .where(eq(tables.events.id, event.id));
        } else {
          console.log(`Event ${event.id}: Successfully handled locally.`);
          await db
            .update(tables.events)
            .set({
              localStatus: "success",
            })
            .where(eq(tables.events.id, event.id));
        }
      }

      if (metadata.publishStatus === "pending") {
        const res = await publishEvent(event);

        if (Result.isErr(res) && res.error !== "CONFLICT") {
          if (res.error === "NETWORK_NOT_REACHABLE") {
            // Retry by throwing error
            throw new Error("NETWORK_NOT_REACHABLE");
          }

          if (res.error instanceof Response && res.error.status >= 500) {
            // Retry by throwing error
            throw new Error("SERVER_ERROR");
          }

          console.error(
            "error publishing event\n\t",
            JSON.stringify(event, null, 2),
            "\n\t",
            JSON.stringify(res, null, 2),
          );

          await db
            .update(tables.events)
            .set({
              publishStatus: "error",
            })
            .where(eq(tables.events.id, event.id));
        } else {
          console.log(`Event ${event.id}: Successfully published event.`);
          await db
            .update(tables.events)
            .set({
              publishStatus: "success",
            })
            .where(eq(tables.events.id, event.id));
        }
      }

      console.log(`Event ${event.id}: Successfully handled.`);

      pop();
    },
  });

  useEffect(() => {
    if (head) {
      handleMutation.mutate(head);
    }
  }, [head]);

  return children;
};
