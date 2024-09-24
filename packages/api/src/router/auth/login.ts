import { z } from "zod";

import { checkPassword } from "@stu/auth/src/password";
import { createSession } from "@stu/auth/src/session";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Users } from "@stu/db/schema";

import { publicProcedure } from "../../procedures";

export const login = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string(),
    }),
  )
  .mutation(async ({ input: { email, password } }) => {
    const user = await db.query.Users.findFirst({
      where: eq(Users.email, email.toLowerCase()),
      with: {
        person: {
          with: {
            student: true,
          },
        },
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
      isOfAge: user.person.student?.isOfAge ?? false,
    });

    return {
      sessionToken: session.token,
      session: session,
      error: undefined,
    };
  });
