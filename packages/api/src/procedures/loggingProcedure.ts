import { t } from "../trpc";

export const logger = t.middleware(async ({ ctx, next, path, type }) => {
  const start = performance.now();

  const result = await next();

  const durationMs = performance.now() - start;
  const meta = { path: path, type: type, durationMs };

  ctx.log.info("procedure", meta);
  await ctx.log.flush();

  return result;
});
