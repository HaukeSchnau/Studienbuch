import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { drizzle } from "drizzle-orm/libsql";

import type {
  EventApplicatorInterface,
  EventName,
  ServerEventApplicator,
} from "@stu/lib";
import { Event } from "@stu/lib";
import { EventApplicator as StudentEventApplicatoe } from "@stu/student";
import * as studentSchema from "@stu/student/schema";

import { createNamespace, createNamespaceClient } from "../../libsql";
import { db, tables } from "../../postgres";
import { protectedProcedure } from "../../procedures";
import { rabbitMqClientPromise } from "../../rabbitmq";
import { serverApplicators } from "../../server-applicators";

const buildStudentApplicator = async (userId: string) => {
  const namespace = `student-${userId}`;
  await createNamespace(namespace);

  const client = createNamespaceClient(namespace);
  const db = drizzle(client, { schema: studentSchema });

  return new StudentEventApplicatoe(db, userId);
};

const applicatorUserMap = new Map<string, EventApplicatorInterface[]>();
const getApplicators = async (userId: string) => {
  if (!applicatorUserMap.has(userId)) {
    applicatorUserMap.set(userId, [await buildStudentApplicator(userId)]);
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion --- we just set it
  return applicatorUserMap.get(userId)!;
};

export const events = {
  ingest: protectedProcedure
    .input(Event)
    .query(async ({ ctx: { session }, input: eventData }) => {
      const applicators = await getApplicators(session.user.id);

      for (const applicator of applicators) {
        if (!(await applicator.verify(eventData))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid event",
          });
        }
      }

      const serverApplicator = serverApplicators[eventData.type] as
        | ServerEventApplicator<EventName>
        | undefined;
      const recipients =
        (await serverApplicator?.recipients?.(eventData)) ?? [];
      //   const related = (await serverApplicator?.related?.(eventData)) ?? []; TODO use this

      for (const applicator of applicators) {
        await applicator.apply(eventData);
      }

      const persistedEvent = {
        id: eventData.id,
        timestamp: eventData.timestamp,
        data: eventData.data,
        type: eventData.type,
        initator: session.user.id,
      };
      await db.insert(tables.events).values(persistedEvent);

      const rabbitMqClient = await rabbitMqClientPromise;
      for (const recipient of recipients) {
        const streamName = `events-${recipient}`;
        const streamSizeRetention = 5 * 1e9;
        await rabbitMqClient.createStream({
          stream: streamName,
          arguments: { "max-length-bytes": streamSizeRetention },
        });

        const publisher = await rabbitMqClient.declarePublisher({
          stream: streamName,
        });
        await publisher.send(Buffer.from(JSON.stringify(persistedEvent)));
      }
    }),
} satisfies TRPCRouterRecord;
