import { z } from "zod";

import { getCookies } from "./cookies";
import { getSession, type Session } from "./session";

export { getCookies } from "./cookies";
export { getPermissions } from "./getPermissions";
export { findPermissionScope } from "./hasPermission";
export { checkPassword, hashPassword } from "./password";
export type { Session } from "./session";
export { createSession, getSession } from "./session";

export const getSessionTokenFromHeaders = (headers: Headers) => {
  return extractTokens(headers).sessionToken ?? null;
};

export const getSessionFromHeaders = async (headers: Headers): Promise<Session | null> => {
  const sessionToken = getSessionTokenFromHeaders(headers);
  if (!sessionToken) {
    return null;
  }

  return getSession(sessionToken);
};

export const isLoggedInFromHeaders = async (headers: Headers): Promise<boolean> => {
  const session = await getSessionFromHeaders(headers);
  return !!session;
};

const cookieSchema = z.object({
  session: z.string().optional(),
});

const extractTokens = (headers: Headers) => {
  return {
    sessionToken: headers.get("x-session") ?? getCookies(headers, cookieSchema)?.session,
  };
};
