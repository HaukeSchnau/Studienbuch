import { z } from "zod";

import { checkPassword, createSession } from "@stu/lib-server";

import { db, eq, tables } from "../../postgres";
import { publicProcedure } from "../../procedures";

export const login = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string(),
    }),
  )
  .mutation(async ({ input: { email, password } }) => {
    const user = await db.query.users.findFirst({
      where: eq(tables.users.email, email.toLowerCase()),
    });

    if (!user) {
      return {
        error: {
          field: "email" as const,
          message: "Kein Nutzer mit dieser E-Mail gefunden",
        },
      };
    }

    if (!user.passwordHash) {
      return {
        error: {
          field: "email" as const,
          message:
            "Für diesen Nutzer wurde kein Passwort festgelegt. Bitte kontaktiere den Support.",
        },
      };
    }

    const passwordMatch = await checkPassword(password, user.passwordHash);
    if (!passwordMatch) {
      return {
        error: {
          field: "password" as const,
          message: "Falsches Passwort",
        },
      };
    }

    const session = createSession({
      id: user.id,
    });

    await db.insert(tables.sessions).values(session);

    return {
      session,
    };
  });
