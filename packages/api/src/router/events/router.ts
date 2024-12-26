import { drizzle } from "drizzle-orm/libsql";

import type {
  Event,
  EventApplicatorInterface,
  EventName,
  ServerEventApplicator,
} from "@stu/lib";
import { EventApplicator as StudentEventApplicator } from "@stu/student";
import * as studentSchema from "@stu/student/schema";

import { createNamespace, createNamespaceClient } from "../../libsql";
import { db, tables } from "../../postgres";
import { rabbitMqClientPromise } from "../../rabbitmq";
import { serverApplicators } from "../../server-applicators";

const buildStudentApplicator = async (userId: string) => {
  const namespace = `student-${userId}`;
  await createNamespace(namespace);

  const client = createNamespaceClient(namespace);
  const db = drizzle(client, { schema: studentSchema });

  return new StudentEventApplicator(db, userId);
};

const applicatorUserMap = new Map<string, EventApplicatorInterface[]>();
const getApplicators = async (userId: string) => {
  if (!applicatorUserMap.has(userId)) {
    applicatorUserMap.set(userId, [await buildStudentApplicator(userId)]);
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion --- we just set it
  return applicatorUserMap.get(userId)!;
};

export const ingest = async <TEventName extends Event["type"]>(
  eventName: TEventName,
  eventData: Omit<Extract<Event, { type: TEventName }>, "errors" | "type">,
  initiatorUserId: string,
) => {
  const applicators = await getApplicators(initiatorUserId);
  const eventDataWithName = {
    ...eventData,
    type: eventName,
  } as Omit<Extract<Event, { type: TEventName }>, "errors">;

  for (const applicator of applicators) {
    const error = await applicator.verify(eventDataWithName);
    if (error) {
      return error;
    }
  }

  const serverApplicator = serverApplicators[eventDataWithName.type] as
    | ServerEventApplicator<EventName>
    | undefined;
  const recipients =
    (await serverApplicator?.recipients?.(eventDataWithName)) ?? [];
  //   const related = (await serverApplicator?.related?.(eventData)) ?? []; TODO use this

  for (const applicator of applicators) {
    await applicator.apply(eventDataWithName);
  }

  const persistedEvent = {
    id: eventData.id,
    timestamp: eventData.timestamp,
    data: eventData.data,
    type: eventDataWithName.type,
    initator: initiatorUserId,
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
};
