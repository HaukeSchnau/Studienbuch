import { z } from "zod";

import { getPermissions } from "@stu/auth/src/getPermissions";
import { checkPassword } from "@stu/auth/src/password";
import { createSession } from "@stu/auth/src/session";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { LicenseKeys, Sessions, Users } from "@stu/db/schema";

import { protectedProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

export const auth = createRouter({
  getSession: publicProcedure.query(({ ctx }) => ctx.session),

  getPermissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.isSuperUser)
      return {
        isSuperUser: true,
      };
    return getPermissions(ctx.session.user);
  }),

  loginWithLicenseKey: publicProcedure
    .input(
      z.object({
        licenseKey: z.string(),
      }),
    )
    .mutation(async ({ input: { licenseKey } }) => {
      const license = await db.query.LicenseKeys.findFirst({
        where: eq(LicenseKeys.key, licenseKey),
        with: {
          activatedBy: {
            with: {
              person: true,
            },
          },
        },
      });

      if (!license) {
        return {
          error: {
            field: "licenseKey" as const,
            message: "Ungültiger Lizenzschlüssel",
          },
        };
      }

      if (!license.activatedBy) {
        return {
          error: {
            field: "licenseKey" as const,
            message: "Für diesen Lizenzschlüssel wurde kein Nutzer gefunden",
          },
        };
      }

      const session = await createSession({
        id: license.activatedBy.id,
        name: license.activatedBy.person.name,
        isSuperUser: license.activatedBy.isSuperUser,
      });

      return {
        session: session,
      };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input: { email, password } }) => {
      const user = await db.query.Users.findFirst({
        where: eq(Users.email, email.toLowerCase()),
        columns: {
          person: false,
        },
        with: {
          person: true,
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

      const session = await createSession({
        id: user.id,
        name: user.person.name,
        isSuperUser: user.isSuperUser,
      });

      return {
        sessionToken: session.token,
        session: session,
        error: undefined,
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.log.info("Logging out");
    await db.delete(Sessions).where(eq(Sessions.token, ctx.session.token));
  }),
});
