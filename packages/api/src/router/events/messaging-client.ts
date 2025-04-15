import type { Event } from "@stu/lib";
import { deserializeEvent, serializeEvent } from "@stu/lib";

import { Client, MessageId } from "pulsar-client";
import { env } from "../../../env";
import { SYSTEM_USER } from "../../constants";

interface Closeable {
  close: () => Promise<unknown>;
}

const pulsarClient = new Client({
  serviceUrl: env.PULSAR_URL,
});

export const publishMessage = async (topic: string, message: string) => {
  const producer = await pulsarClient.createProducer({
    topic,
  });
  await producer.send({
    data: Buffer.from(message),
  });
  await producer.flush();
  await producer.close();
};

export const publishEvent = async (
  event: Omit<Event, "errors">,
  recipient: string,
) => {
  if (recipient === SYSTEM_USER) {
    return;
  }

  await publishMessage(recipient, serializeEvent(event));
};

export const subscribe = async (
  topic: string,
  offset: string | undefined, // TODO: use this
  listener: (event: Event) => void,
): Promise<Closeable> => {
  return pulsarClient.createReader({
    topic,
    startMessageId: MessageId.earliest(),
    listener: (message) => {
      const event = deserializeEvent(message.getData().toString());
      if (!event.success) {
        console.error("Invalid event", event.error);
        return;
      }
      listener(event.data);
    },
  });
};
