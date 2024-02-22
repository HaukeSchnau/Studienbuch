import { z } from "zod";

import { getCookies } from "@schnau/common/src/cookies";
import { db } from "@schnau/db";

export interface Session {
  token: string;
  expires: Date;
  user: {
    id: number;
    name: string;
    email: string | null;
    image: string | null;
  } | null;
}

const cookieSchema = z.object({
  session: z.string().optional(),
});

export const authHandler = (
  requestHandler: (req: Request, session: Session | null) => Promise<Response>,
) => {
  return async (req: Request) => {
    const sessionToken =
      req.headers.get("x-session") ??
      getCookies(req.headers, cookieSchema)?.session;

    const session = sessionToken
      ? await db.session.findFirst({
          where: {
            token: sessionToken,
          },
          include: {
            user: true,
          },
        })
      : null;

    return requestHandler(req, session);
  };
};
