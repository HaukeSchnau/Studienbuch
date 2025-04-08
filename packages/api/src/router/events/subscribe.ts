import rabbit from "rabbitmq-stream-js-client";

import type { Event } from "@stu/lib";
import { deserializeEvent } from "@stu/lib";

import { ensureStream, rabbitMqClientPromise } from "../../rabbitmq";

interface Closeable {
  close: () => Promise<void>;
}

export const subscribe = async (
  userId: string,
  offset: string | undefined,
  callback: (event: Event) => void,
): Promise<Closeable> => {
  const streamName = userId;

  const rabbitMqClient = await rabbitMqClientPromise;
  await ensureStream(rabbitMqClient, streamName);

  const consumer = await rabbitMqClient.declareConsumer(
    {
      stream: streamName,
      offset:
        offset !== undefined
          ? rabbit.Offset.offset(BigInt(offset))
          : rabbit.Offset.first(),
    },
    (message) => {
      const event = deserializeEvent(message.content.toString());
      if (!event.success) {
        console.error("Invalid event", event.error);
        return;
      }
      callback(event.data);
    },
  );

  return {
    close: () => consumer.close(true),
  };
};
