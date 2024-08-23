import { cache } from "react";
import { headers } from "next/headers";
import { getCookies } from "@stu/auth/src/cookies";
import { getSession } from "@stu/auth/src/session";
import { z } from "zod";

export const isLoggedIn = cache(async () => {
  const cookie = getCookies(headers(), z.object({ session: z.string() }));
  if (!cookie) {
    return false;
  }

  const session = await getSession(cookie.session);

  return !!session?.user;
});
