import { z } from "zod";

import { getCookies } from "./cookies";
import { getSession } from "./session";

export { checkPassword, hashPassword } from "./password";
export { getSession, createSession } from "./session";
export { getCookies } from "./cookies";
export { findPermissionScope } from "./hasPermission";
export { getPermissions } from "./getPermissions";

interface User {
  id: string;
  name: string;
  isSuperUser: boolean;
  isOfAge: boolean;
}

export interface Session {
  user: User | null;
  token: string;
}

export interface AuthenticatedSession {
  user: User;
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
