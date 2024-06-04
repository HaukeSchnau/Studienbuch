import crypto from "crypto";

import type { User } from "@schnau/lib";
import { eq } from "@schnau/db";
import { db } from "@schnau/db/client";
import { Session } from "@schnau/db/schema";
import { isArraySingleElement } from "@schnau/lib";

import type { Session as SessionType } from "./index";

export const getSession = async (sessionToken: string) => {
  const session = await db.query.Session.findFirst({
    with: {
      user: true,
    },
    where: eq(Session.token, sessionToken),
  });

  if (!session) {
    return null;
  }

  if (session.expires < new Date()) {
    await db.delete(Session).where(eq(Session.token, sessionToken));
    return null;
  }

  return session;
};

export const createSession = async (user: User): Promise<SessionType> => {
  const newSession = await db
    .insert(Session)
    .values({
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // in 30 days
      token: crypto.randomUUID(),
      userId: user.id,
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
