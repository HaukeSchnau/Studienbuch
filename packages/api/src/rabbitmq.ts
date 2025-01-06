import * as rabbit from "rabbitmq-stream-js-client";

import { env } from "../env";

export const rabbitMqClientPromise = rabbit.connect({
  hostname: env.RABBITMQ_HOST,
  port: 5552,
  username: "guest",
  password: "guest",
  vhost: "/",
});

export type RabbitMQClient = Awaited<typeof rabbitMqClientPromise>;

export const ensureStream = async (
  client: RabbitMQClient,
  streamName: string,
) => {
  const streamSizeRetention = 5 * 1e9;
  await client.createStream({
    stream: streamName,
    arguments: { "max-length-bytes": streamSizeRetention },
  });
};
