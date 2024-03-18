import crypto from "crypto";
import { z } from "zod";

import { db } from "@schnau/db";

import type { Session } from "./index";

export const sessionSchema = z.object({
  token: z.string(),
  expires: z.coerce.date(),
  user: z
    .object({
      id: z.number(),
      email: z.string().nullable(),
      name: z.string(),
    })
    .nullable(),
});

// export type Session = z.infer<typeof sessionSchema>;
// export type AuthenticatedSession = Omit<Session, "user"> & {
//   user: NonNullable<Session["user"]>;
// };

export const getSession = (sessionToken: string) => {
  return db.session.findFirst({
    where: {
      token: sessionToken,
    },
    include: {
      user: true,
    },
  });
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
