import type { Event, PersistedEvent } from "@stu/lib";
import { eventApplicator as systemApplicator } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { Result, serializeEvent } from "@stu/lib";

import { SYSTEM_USER } from "../../constants";
import { ensureStream, rabbitMqClientPromise } from "../../rabbitmq";
import { sendMissingEventsToStudent } from "./send-missing-events";

export const publishEvent = async (
  event: Omit<Event, "errors">,
  recipient: string,
) => {
  if (recipient === SYSTEM_USER) {
    return;
  }

  const rabbitMqClient = await rabbitMqClientPromise;
  await ensureStream(rabbitMqClient, recipient);
  const publisher = await rabbitMqClient.declarePublisher({
    stream: recipient,
  });
  await publisher.basicSend(
    BigInt(event.timestamp.getTime()),
    Buffer.from(serializeEvent(event)),
    {
      messageProperties: {
        messageId: event.id,
      },
    },
  );

  await db.insert(tables.eventsSentToUsers).values({
    event: event.id,
    user: recipient,
  });
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
  };
  await db.insert(tables.events).values(persistedEvent);

  const topics = await systemApplicator.topics?.(eventDataWithName);
  if (topics?.length) {
    await db.insert(tables.eventTopics).values(
      topics.map((topic) => ({
        event: persistedEvent.id,
        topic,
      })),
    );
  }

  const recipientIds = new Set(
    (await systemApplicator.recipients?.(eventDataWithName)) ?? [],
  );
  recipientIds.add(initiatorUserId);
  await sendMissingEventsToStudent(initiatorUserId);
  for (const recipientId of recipientIds) {
    await publishEvent(eventDataWithName, recipientId);
  }

  return Result.ok(undefined);
};
