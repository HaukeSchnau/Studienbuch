import type { TRPCRouterRecord } from "@trpc/server";

import { eq, and, sql } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";

// import { getPermissions } from "@stu/lib-server";

import { protectedProcedure, publicProcedure } from "../../procedures";
import { activateLicenseKey } from "./activate-license-key";
import { checkLicenseKey } from "./check-license-key";
import { login } from "./login";
import { z } from "zod";

export const auth = {
  getSession: publicProcedure.query(({ ctx }) => ctx.session),

  // getPermissions: protectedProcedure.query(async ({ ctx }) => {
  //   if (ctx.session.user.isSuperUser)
  //     return {
  //       isSuperUser: true,
  //     };
  //   return getPermissions(ctx.session.user);
  // }),

  login,

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.log.info("Logging out");
    await db.delete(tables.Sessions).where(eq(tables.Sessions.token, ctx.session.token));
  }),

  checkLicenseKey,
  activateLicenseKey,

  addNotificationToken: protectedProcedure
    .input(
      z.object({
        notificationToken: z.string(),
      }),
    )
    .mutation(async ({ ctx, input: { notificationToken } }) => {
      const doesNotificationTokenExist = await db.query.Users.findFirst({
        where: and(
          eq(tables.Users.id, ctx.session.user.id),
          sql`${notificationToken} = ANY(${tables.Users.notificationTokens})`,
        ),
      });

      if (doesNotificationTokenExist) {
        return;
      }

      await db
        .update(tables.Users)
        .set({
          // notificationTokens: sql`${tables.Users.notificationTokens} || '${notificationToken}'`,
          notificationTokens: sql`ARRAY_APPEND(${tables.Users.notificationTokens}, ${notificationToken})`,
        })
        .where(eq(tables.Users.id, ctx.session.user.id));
    }),
} satisfies TRPCRouterRecord;
