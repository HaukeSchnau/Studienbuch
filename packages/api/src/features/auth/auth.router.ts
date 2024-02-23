import { z } from "zod";

import type { Session } from "@schnau/auth/src";
import { createJwt } from "@schnau/auth/src/jwt";
import { db } from "@schnau/db";

import { checkPassword } from "../../../../lib/src/auth/password";
import { publicProcedure } from "../../procedures/publicProcedure";
import { createRouter } from "../../trpc";

export const authRouter = createRouter({
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
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

      const session: Session = {
        user,
      };

      // const newSession = await createSession(user);
      const newJwt = createJwt(session);

      return {
        sessionToken: newJwt,
        session,
        error: undefined,
      };
    }),
});
