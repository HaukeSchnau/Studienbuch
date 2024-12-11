import * as rabbit from "rabbitmq-stream-js-client";

import { env } from "../env";

export const rabbitMqClientPromise = rabbit.connect({
  hostname: env.RABBITMQ_HOST,
  port: 5552,
  username: "guest",
  password: "guest",
  vhost: "/",
});
