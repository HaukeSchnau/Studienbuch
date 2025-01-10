import { useEffect, useState } from "react";
import { asc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import superjson from "superjson";

import { Event } from "@stu/lib";
import * as tables from "@stu/student/schema";

import { db } from "~/db/client";
import { publishEvent } from "../api";

export const MutationManager = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [initialized, setInitialized] = useState(false);

  const { data: muts } = useLiveQuery(
    db
      .select()
      .from(tables.events)
      .where(eq(tables.events.status, "APPLIED"))
      .orderBy(asc(tables.events.timestamp)),
  );

  useEffect(() => {
    const abortSignal = new AbortController();
    void (async () => {
      for (const mut of muts) {
        if (abortSignal.signal.aborted) {
          return;
        }
        const input = superjson.parse(mut.data);
        const event = Event.safeParse(input);

        if (!event.success) {
          console.error("error parsing event", mut, event.error);
          await db
            .update(tables.events)
            .set({ status: "FAILED" })
            .where(eq(tables.events.id, mut.id));
          continue;
        }

        try {
          const res = await publishEvent(event.data);

          if (res.status !== 200) {
            console.error("error publishing event", mut, res);
            await db
              .update(tables.events)
              .set({ status: "FAILED" })
              .where(eq(tables.events.id, mut.id));
            continue;
          }

          await db
            .update(tables.events)
            .set({
              status: "PUBLISHED",
            })
            .where(eq(tables.events.timestamp, mut.timestamp));
        } catch (e) {
          console.error("error publishing event", mut, e);
          await db
            .update(tables.events)
            .set({
              status: "FAILED",
            })
            .where(eq(tables.events.timestamp, mut.timestamp));
        }
      }
      setInitialized(true);
    })();

    return () => {
      abortSignal.abort();
    };
  }, [muts]);

  return initialized ? children : null;
};
