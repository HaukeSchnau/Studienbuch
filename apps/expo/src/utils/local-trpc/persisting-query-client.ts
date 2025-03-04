import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { asc, eq, or } from "drizzle-orm";
import superjson from "superjson";
import { create } from "zustand";

import { Event, Result } from "@stu/lib";
import * as tables from "@stu/student/schema";

import type { LocalEvent } from "../ingest";
import { db } from "~/db/client";
import { getEventStream, publishEvent } from "../api";
import { ingestExistingEvent, parseLocalEvent } from "../ingest";
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

  const [session] = useStorage("auth.session");
  const sessionToken = session?.token;

  // Subscribe to rabbitmq events
  useEffect(() => {
    if (!sessionToken) return;

    console.log("user id", session.user);
    const eventStream = getEventStream(sessionToken);
    eventStream.addEventListener("message", (event) => {
      if (!event.data) {
        console.error("no data in event", event);
        return;
      }
      const data = superjson.parse(event.data);
      const e = Event.safeParse(data);
      console.log("REMOTE RMQ EVENT ---", e.data?.type, e.data?.data);
    });

    return () => {
      eventStream.close();
    };
  }, [sessionToken]);

  // Initialize the queue with events that are not done yet
  useEffect(() => {
    console.log("initializing");

    db.select()
      .from(tables.events)
      .where(
        or(
          eq(tables.events.isAppliedLocally, false),
          eq(tables.events.isPublished, false),
        ),
      )
      .orderBy(asc(tables.events.timestamp))
      .then((muts) => {
        console.log("initialized", muts);
        initialize(
          muts.map(parseLocalEvent).filter((mut) => mut !== undefined),
        );
      })
      .catch((reason) =>
        console.error("error while finding mutations", reason),
      );
  }, []);

  const handleMutation = useMutation({
    retry: true,
    mutationFn: async ({ event, metadata }: LocalEvent) => {
      console.log("handling mutation", event);
      if (!session?.user) {
        throw new Error("NO_USER_IN_SESSION");
      }

      if (!metadata.isPublished) {
        const res = await publishEvent(event);

        if (Result.isErr(res) && res.error !== "CONFLICT") {
          if (res.error === "NETWORK_NOT_REACHABLE") {
            throw new Error("NETWORK_NOT_REACHABLE");
          }

          console.error(
            "error publishing event\n\t",
            JSON.stringify(event, null, 2),
            "\n\t",
            JSON.stringify(res, null, 2),
          );
          return;
        }
      }

      if (!metadata.isAppliedLocally) {
        console.log("applying locally");
        const res = await ingestExistingEvent(event.id, session.user);
        if (Result.isErr(res)) {
          console.error("failed to apply locally", res);
        }
      }
    },
  });

  useEffect(() => {
    console.log("head", head);
    if (head) {
      handleMutation.mutate(head);
    }
  }, [head]);

  return children;
};
