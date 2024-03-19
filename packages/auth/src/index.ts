import { z } from "zod";

import { getCookies } from "./cookies";
import { getSession } from "./session";

export interface Session {
  user: {
    id: number;
    name: string;
    isSuperUser: boolean;
  } | null;
  token: string;
}

export const getSessionFromHeaders = async (headers: Headers) => {
  const { sessionToken } = extractTokens(headers);

  if (sessionToken) {
    return {
      session: await getSession(sessionToken),
      error: null,
    };
  }

  return {
    session: null,
    error: null,
  };
};

const cookieSchema = z.object({
  session: z.string().optional(),
});

const extractTokens = (headers: Headers) => {
  return {
    sessionToken:
      headers.get("x-session") ?? getCookies(headers, cookieSchema)?.session,
  };
};
