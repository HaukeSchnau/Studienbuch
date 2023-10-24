import crypto from "crypto";
import { z } from "zod";

import { db } from "@acme/db";

import { publicProcedure } from "../../procedures/publicProcedure";
import { createRouter } from "../../trpc";
import { checkPassword } from "./password";

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
          session: undefined,
        };
      }

      const passwordMatch = await checkPassword(password, user.passwordHash);

      if (!passwordMatch) {
        return {
          error: {
            field: "password" as const,
            message: "Falsches Passwort",
          },
          session: undefined,
        };
      }

      const newSession = await db.session.create({
        data: {
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // in 30 days
          token: crypto.randomBytes(32).toString("base64"),
          user: {
            connect: {
              id: user.id,
            },
          },
        },
        include: {
          user: true,
        },
      });

      return {
        session: newSession,
        error: undefined,
      };
    }),
});
