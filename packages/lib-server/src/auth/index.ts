import { z } from "zod";

import { getCookies } from "./cookies";

export { checkPassword, hashPassword } from "./password";
export { createSession } from "./session";
export { getCookies } from "./cookies";
export { findPermissionScope } from "./hasPermission";
export { getPermissions } from "./getPermissions";

export interface Session {
  user: {
    id: string;
    isOfAge?: undefined;
  };
  token: string;
}

export const getSessionTokenFromHeaders = (headers: Headers) => {
  return extractTokens(headers).sessionToken ?? null;
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
