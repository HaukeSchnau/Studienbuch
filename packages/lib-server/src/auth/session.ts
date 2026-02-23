import crypto from "node:crypto";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Sessions } from "@stu/db/schema";

export interface Session {
  user: {
    id: string;
    isOfAge?: undefined;
  };
  token: string;
}

export const createSession = (user: { id: string }) => {
  return {
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // in 30 days
    token: crypto.randomUUID(),
    user: user.id,
  };
};

export const getSession = async (sessionToken: string): Promise<Session | null> => {
  const session = await db.query.Sessions.findFirst({
    where: eq(Sessions.token, sessionToken),
    with: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expires < new Date() || !session.user) {
    await db.delete(Sessions).where(eq(Sessions.token, sessionToken));
    return null;
  }

  return {
    token: session.token,
    user: {
      id: session.user.id,
    },
  };
};
