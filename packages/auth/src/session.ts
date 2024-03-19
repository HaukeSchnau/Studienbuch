import crypto from "crypto";

import { db } from "@schnau/db";

import type { Session } from "./index";

export const getSession = async (sessionToken: string) => {
  const session = await db.session.findFirst({
    where: {
      token: sessionToken,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expires < new Date()) {
    await db.session.delete({
      where: {
        token: sessionToken,
      },
    });
    return null;
  }

  return session;
};

export const createSession = (user: { id: number }): Promise<Session> => {
  return db.session.create({
    data: {
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // in 30 days
      token: crypto.randomUUID(),
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
};
