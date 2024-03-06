import { createClient } from "redis";

import { env } from "../env";

const createRedis = () => {
  return createClient({
    url: env.REDIS_URL,
  });
};

type RedisClient = ReturnType<typeof createRedis>;

const globalThisForRedis = globalThis as { redis?: RedisClient };

export const getRedis = async (): Promise<RedisClient> => {
  if (!globalThisForRedis.redis) {
    const redis = createRedis();
    globalThisForRedis.redis = redis;
    await redis.connect();
    return redis;
  }

  return globalThisForRedis.redis;
};

export const getCachedResponse = async (key: string, field: string) => {
  const client = await getRedis();
  const data = await client.hGet(key, field);

  return data ? (JSON.parse(data) as unknown) : null;
};

export const cacheResponse = async (
  key: string,
  field: string,
  data: unknown,
  expirationInSeconds: number,
) => {
  const client = await getRedis();
  const serializedData = JSON.stringify(data);
  await client.hSet(key, field, serializedData);
  await client.expire(key, expirationInSeconds);
};
