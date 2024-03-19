import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { getCookies } from "@schnau/auth/src/cookies";
import { getSession } from "@schnau/auth/src/session";

export const isLoggedIn = cache(async () => {
  const cookie = getCookies(headers(), z.object({ session: z.string() }));
  if (!cookie) {
    return false;
  }

  const session = await getSession(cookie.session);

  return !!session?.user;
});
