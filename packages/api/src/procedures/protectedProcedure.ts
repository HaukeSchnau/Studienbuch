import type { Permission } from "@stu/lib";
import { TRPCError } from "@trpc/server";

import { t } from "../trpc";
import { logger } from "./loggingProcedure";

/**
 * Reusable middleware that enforces users are logged in before running the
 * procedure
 */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: ctx.session,
    },
  });
});

/**
 * Protected (authed) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged-in users, use
 * this. It verifies the session is valid and guarantees ctx.session.user is not
 * null
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(logger).use(enforceUserIsAuthed);

export const permissionProcedure = (_permission: Permission) =>
  t.procedure.use(
    t.middleware(async ({ ctx, next }) => {
      const user = ctx.session?.user;
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // const permissionScope = await findPermissionScope(user, permission);
      const permissionScope = null;
      // oxlint-disable-next-line @typescripttypescript/no-unnecessary-condition -- TODO: implement
      if (!permissionScope) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return next({
        ctx: {
          session: {
            ...ctx.session,
            user,
          },
          permissionScope,
        },
      });
    }),
  );
