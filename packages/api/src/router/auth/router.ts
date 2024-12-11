import type { TRPCRouterRecord } from "@trpc/server";

// import { eq } from "@stu/db";
// import { db } from "@stu/db/client";
// import { Sessions } from "@stu/db/schema";
import { db, eq, tables } from "../../postgres";
// import { getPermissions } from "@stu/lib-server";

import { protectedProcedure, publicProcedure } from "../../procedures";
import { activateLicenseKey } from "./activate-license-key";
import { checkLicenseKey } from "./check-license-key";
import { login } from "./login";
import { loginWithLicenseKey } from "./login-with-license-key";

export const auth = {
  getSession: publicProcedure.query(({ ctx }) => ctx.session),

  // getPermissions: protectedProcedure.query(async ({ ctx }) => {
  //   if (ctx.session.user.isSuperUser)
  //     return {
  //       isSuperUser: true,
  //     };
  //   return getPermissions(ctx.session.user);
  // }),

  loginWithLicenseKey,
  login,

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.log.info("Logging out");
    await db
      .delete(tables.sessions)
      .where(eq(tables.sessions.token, ctx.session.token));
  }),

  checkLicenseKey,
  activateLicenseKey,
} satisfies TRPCRouterRecord;
