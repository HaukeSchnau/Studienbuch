import { createClient } from "redis";

import { env } from "../env";

const createRedis = () => {
  return createClient({
    url: env.REDIS_URL,
  }).connect();
};

type RedisClient = Awaited<ReturnType<typeof createRedis>>;

const globalThisForRedis = globalThis as { redis?: RedisClient };

export const getRedis = async (): Promise<RedisClient> => {
  const redis = globalThisForRedis.redis ?? (await createRedis());
  if (process.env.NODE_ENV !== "production") globalThisForRedis.redis = redis;
  return redis;
};
