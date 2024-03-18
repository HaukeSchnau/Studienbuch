import type { Permission } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { findPermissionScope } from "@schnau/auth/src/hasPermission";

import { t } from "../trpc";

/**
 * Reusable middleware that enforces users are logged in before running the
 * procedure
 */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
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
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

export const permissionProcedure = (permission: Permission) =>
  t.procedure.use(
    t.middleware(async ({ ctx, next }) => {
      const user = ctx.session?.user;
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const permissionScope = await findPermissionScope(user, permission);
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
