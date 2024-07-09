import { z } from "zod";

import { getPermissions } from "@schnau/auth/src/getPermissions";
import { checkPassword } from "@schnau/auth/src/password";
import { createSession } from "@schnau/auth/src/session";
import { eq } from "@schnau/db";
import { db } from "@schnau/db/client";
import { Session, User } from "@schnau/db/schema";

import { protectedProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

export const auth = createRouter({
  getSession: publicProcedure.query(({ ctx }) => {
    console.log("getSession", ctx.session);
    return ctx.session;
  }),

  getPermissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.isSuperUser)
      return {
        isSuperUser: true,
      };
    return getPermissions(ctx.session.user);
  }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input: { email, password } }) => {
      const user = await db.query.User.findFirst({
        where: eq(User.email, email.toLowerCase()),
      });

      if (!user) {
        return {
          error: {
            field: "email" as const,
            message: "Kein Nutzer mit dieser E-Mail gefunden",
          },
          sessionToken: undefined,
        };
      }

      if (!user.passwordHash) {
        return {
          error: {
            field: "email" as const,
            message:
              "Für diesen Nutzer wurde kein Passwort festgelegt. Bitte kontaktiere den Support.",
          },
          sessionToken: undefined,
        };
      }

      const passwordMatch = await checkPassword(password, user.passwordHash);
      if (!passwordMatch) {
        return {
          error: {
            field: "password" as const,
            message: "Falsches Passwort",
          },
          sessionToken: undefined,
        };
      }

      const session = await createSession(user);

      return {
        sessionToken: session.token,
        session: session,
        error: undefined,
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.log.info("Logging out");
    await db.delete(Session).where(eq(Session.token, ctx.session.token));
  }),
});
