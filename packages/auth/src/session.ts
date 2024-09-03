import crypto from "crypto";

import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Sessions } from "@stu/db/schema";
import { isArraySingleElement } from "@stu/lib";

import type { Session, Session as SessionType } from "./index";

export const getSession = async (
  sessionToken: string,
): Promise<Session | null> => {
  const session = await db.query.Sessions.findFirst({
    with: {
      user: {
        with: {
          person: true,
        },
      },
    },
    where: eq(Sessions.token, sessionToken),
  });

  if (!session) {
    return null;
  }

  if (session.expires < new Date()) {
    await db.delete(Sessions).where(eq(Sessions.token, sessionToken));
    return null;
  }

  return {
    user: session.user
      ? {
          id: session.user.id,
          isSuperUser: session.user.isSuperUser,
          name: session.user.person.name,
        }
      : null,
    token: session.token,
  };
};

export const createSession = async (user: {
  id: string;
  isSuperUser: boolean;
  name: string;
}): Promise<SessionType> => {
  const newSession = await db
    .insert(Sessions)
    .values({
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // in 30 days
      token: crypto.randomUUID(),
      user: user.id,
    })
    .returning();
  if (!isArraySingleElement(newSession)) {
    throw new Error("Expected exactly one session to be created");
  }

  return {
    ...newSession[0],
    user,
  };
};
