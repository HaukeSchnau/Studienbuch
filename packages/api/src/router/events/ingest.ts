import superjson from "superjson";

import type { Event, EventApplicatorInterface, PersistedEvent } from "@stu/lib";
import { eventApplicator as systemApplicator } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { Result } from "@stu/lib";

import type { RabbitMQClient } from "../../rabbitmq";
import { SYSTEM_USER } from "../../constants";
import { ensureStream, rabbitMqClientPromise } from "../../rabbitmq";
import { serverApplicators } from "../../server-applicators";

// const buildStudentApplicator = async (
//   userId: string,
// ): Promise<EventApplicatorInterface> => {
//   const namespace = `student-${userId}`;
//   await createNamespace(namespace);

//   const client = createNamespaceClient(namespace);
//   const db = drizzle(client, { schema: studentSchema });

//   return new StudentEventApplicator(db, userId);
// };

// const applicatorUserMap = new Map<string, EventApplicatorInterface>();
// const getStudentApplicators = async (
//   userId: string,
// ): Promise<EventApplicatorInterface> => {
//   if (!applicatorUserMap.has(userId)) {
//     applicatorUserMap.set(userId, await buildStudentApplicator(userId));
//   }

//   // eslint-disable-next-line @typescript-eslint/no-non-null-assertion --- we just set it
//   return applicatorUserMap.get(userId)!;
// };

// const getApplicators = async (
//   userId: string,
// ): Promise<EventApplicatorInterface> => {
//   // if (userId === SYSTEM_USER) {
//   return systemApplicator;
//   // }
//   //
//   // return getStudentApplicators(userId);
// };

const publishEvent = async (
  rabbitMqClient: RabbitMQClient,
  persistedEvent: PersistedEvent,
  recipient: string,
) => {
  const streamName = `events-${recipient}`;
  await ensureStream(rabbitMqClient, streamName);

  const publisher = await rabbitMqClient.declarePublisher({
    stream: streamName,
  });
  const { initiator: _, ...publicEvent } = persistedEvent;

  await publisher.basicSend(
    BigInt(persistedEvent.timestamp.getTime()),
    Buffer.from(superjson.stringify(publicEvent)),
    {
      messageProperties: {
        messageId: persistedEvent.id,
      },
    },
  );
};

const ensureSystemUser = async () => {
  await db
    .insert(tables.Users)
    .values({
      id: SYSTEM_USER,
      isSuperUser: true,
    })
    .onConflictDoNothing();
};

export const ingest = async <TEventName extends Event["type"]>(
  eventName: TEventName,
  eventData: Omit<Extract<Event, { type: TEventName }>, "errors" | "type">,
  initiatorUserId: string,
) => {
  await ensureSystemUser();

  const context = {
    initiatorUserId,
  };

  const eventDataWithName = {
    ...eventData,
    type: eventName,
  } as Omit<Extract<Event, { type: TEventName }>, "errors">;

  const serverApplicator = serverApplicators[eventName];

  const error = await systemApplicator.verify(eventDataWithName, context);
  if (error) {
    return Result.err(error);
  }

  try {
    await systemApplicator.apply(eventDataWithName);
  } catch (err) {
    console.error(
      `Could not apply event ${eventDataWithName.type} with data ${JSON.stringify(eventDataWithName.data)}`,
    );
    throw err;
  }

  const persistedEvent: PersistedEvent = {
    ...eventDataWithName,
    initiator: initiatorUserId,
    entities:
      (await serverApplicator.entities?.(eventDataWithName, context))?.filter(
        (entity) => entity !== undefined,
      ) ?? [],
  };
  await db.insert(tables.events).values(persistedEvent);

  const recipientIds = new Set(
    await serverApplicator.recipients?.(eventDataWithName, context),
  );
  recipientIds.add(SYSTEM_USER);
  recipientIds.add(initiatorUserId);
  const rabbitMqClient = await rabbitMqClientPromise;
  for (const recipientId of recipientIds) {
    await publishEvent(rabbitMqClient, persistedEvent, recipientId);
  }

  return Result.ok(undefined);
};
