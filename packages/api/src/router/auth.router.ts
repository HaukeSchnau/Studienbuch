import { z } from "zod";

import { getPermissions } from "@schnau/auth/src/getPermissions";
import { checkPassword } from "@schnau/auth/src/password";
import { createSession } from "@schnau/auth/src/session";
import { db } from "@schnau/db";

import { protectedProcedure } from "../procedures/protectedProcedure";
import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const auth = createRouter({
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  getPermissions: protectedProcedure.query(async ({ ctx }) => {
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
      const user = await db.user.findFirst({
        where: {
          email: email.toLowerCase(),
        },
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

      const newSession = await createSession(user);

      return {
        sessionToken: newSession.token,
        session: newSession,
        error: undefined,
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.log.info("Logging out");
    await db.session.delete({
      where: {
        token: ctx.session.token,
      },
    });
  }),
});
