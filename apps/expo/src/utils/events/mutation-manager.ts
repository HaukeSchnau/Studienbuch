import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { create } from "zustand";

import { Result } from "@stu/lib";
import * as tables from "@stu/student/schema";

import type { LocalEvent } from "./ingest";
import { db } from "~/db/client";
import { publishEvent } from "../api";
import { useStorage } from "../storage";
import { getEventsToBePushed, ingestExistingEvent } from "./ingest";
import { useRemoteEventStream } from "./use-event-stream";

interface MutationStore {
  queue: LocalEvent[];
  initialize: (muts: LocalEvent[]) => void;
  push: (mutation: LocalEvent) => void;
  pop: () => void;
}

export const useMutationStore = create<MutationStore>((set) => ({
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
    console.log("Initializing local events");

    // Initialize the queue with events that are not done yet
    getEventsToBePushed()
      .then((muts) => {
        console.log("Initialized local events to be pushed", muts);
        initialize(muts);
      })
      .catch((reason) =>
        console.error("error while finding mutations", reason),
      );
  }, [initialize]);

  useRemoteEventStream({ sessionToken, onEvent: push });

  const { mutate: handle } = useMutation({
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
      handle(head);
    }
  }, [handle, head]);

  return children;
};
