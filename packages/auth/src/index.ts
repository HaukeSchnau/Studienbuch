import { z } from "zod";

import { getCookies } from "./cookies";
import { getSession } from "./session";

export interface Session {
  user: {
    id: string;
    name: string;
    isSuperUser: boolean;
    isOfAge: boolean;
  } | null;
  token: string;
}

export const getSessionFromHeaders = async (
  headers: Headers,
): Promise<Session | null> => {
  const { sessionToken } = extractTokens(headers);

  if (sessionToken) {
    return getSession(sessionToken);
  }

  return null;
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
