import { z } from "zod";

import { getCookies } from "./cookies";
import { verifyAndDecodeJwt } from "./jwt";
import { getSession } from "./session";

export interface Session {
  user: {
    name: string;
  } | null;
}

export const getSessionFromHeaders = async (headers: Headers) => {
  const { sessionToken, jwt } = extractTokens(headers);

  if (sessionToken && jwt) {
    return {
      session: null,
      error: "BOTH_SESSION_AND_JWT_PRESENT" as const,
    };
  }

  if (sessionToken) {
    return {
      session: await getSession(sessionToken),
      error: null,
    };
  }
  if (jwt) {
    return {
      session: verifyAndDecodeJwt(jwt),
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
  jwt: z.string().optional(),
});

const extractTokens = (headers: Headers) => {
  return {
    sessionToken:
      headers.get("x-session") ?? getCookies(headers, cookieSchema)?.session,
    jwt:
      headers.get("authentication") ?? getCookies(headers, cookieSchema)?.jwt,
  };
};
