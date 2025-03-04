import { t } from "../trpc";

export const logger = t.middleware(async ({ ctx, next, path, type }) => {
  const start = performance.now();

  const result = await next();

  const durationMs = performance.now() - start;
  const meta = { path, type, durationMs };

  // TODO reactivate
  // ctx.log.info("tRPC", { trpc: meta });
  // await ctx.log.flush();

  return result;
});
