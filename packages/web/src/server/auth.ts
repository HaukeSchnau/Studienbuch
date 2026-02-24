import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Persons, Users } from "@stu/db/schema";
import type { Permission } from "@stu/lib";
import { checkPassword, findPermissionScope } from "@stu/lib-server";
import { z } from "zod";

import { useWebSession } from "./session";

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export type WebSessionUser = {
  id: string;
  isSuperUser: boolean;
  email: string | null;
  firstName?: string;
  lastName?: string;
};

export type LoginResult =
  | {
      error: {
        field: "email" | "password";
        message: string;
      };
    }
  | {
      ok: true;
      user: WebSessionUser;
    };

const findUserById = async (userId: string): Promise<WebSessionUser | null> => {
  const row = await db
    .select({
      id: Users.id,
      isSuperUser: Users.isSuperUser,
      email: Users.email,
      firstName: Persons.firstName,
      lastName: Persons.lastName,
    })
    .from(Users)
    .leftJoin(Persons, eq(Persons.id, Users.id))
    .where(eq(Users.id, userId))
    .then((rows) => rows[0]);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    isSuperUser: row.isSuperUser,
    email: row.email,
    firstName: row.firstName ?? undefined,
    lastName: row.lastName ?? undefined,
  };
};

export const getCurrentSessionUser = async (): Promise<WebSessionUser | null> => {
  const session = await useWebSession();
  if (!session.data.userId) {
    return null;
  }

  return findUserById(session.data.userId);
};

export const requireCurrentSessionUser = async (): Promise<WebSessionUser> => {
  const user = await getCurrentSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
};

export const loginWithPassword = async (input: LoginInput): Promise<LoginResult> => {
  const user = await db.query.Users.findFirst({
    where: eq(Users.email, input.email.toLowerCase()),
  });

  if (!user) {
    return {
      error: {
        field: "email",
        message: "Kein Nutzer mit dieser E-Mail gefunden",
      },
    };
  }

  if (!user.passwordHash) {
    return {
      error: {
        field: "email",
        message: "Für diesen Nutzer wurde kein Passwort festgelegt. Bitte kontaktiere den Support.",
      },
    };
  }

  const passwordMatch = await checkPassword(input.password, user.passwordHash);
  if (!passwordMatch) {
    return {
      error: {
        field: "password",
        message: "Falsches Passwort",
      },
    };
  }

  const session = await useWebSession();
  await session.update({
    userId: user.id,
  });

  const sessionUser = await findUserById(user.id);
  if (!sessionUser) {
    throw new Error("Unable to load user after login");
  }

  return {
    ok: true,
    user: sessionUser,
  };
};

export const logoutSession = async (): Promise<void> => {
  const session = await useWebSession();
  await session.clear();
};

export const hasCurrentUserPermission = async (permission: Permission): Promise<boolean> => {
  const user = await getCurrentSessionUser();
  if (!user) {
    return false;
  }

  const scope = await findPermissionScope(user.id, permission);
  return !!scope;
};

export const requireCurrentUserPermission = async (permission: Permission): Promise<void> => {
  const allowed = await hasCurrentUserPermission(permission);
  if (!allowed) {
    throw new Error("FORBIDDEN");
  }
};
