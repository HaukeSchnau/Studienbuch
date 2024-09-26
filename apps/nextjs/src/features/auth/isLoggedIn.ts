import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { getCookies, getSession } from "@stu/lib-server";

export const isLoggedIn = cache(async () => {
  const cookie = getCookies(headers(), z.object({ session: z.string() }));
  if (!cookie) {
    return false;
  }

  const session = await getSession(cookie.session);

  return !!session?.user;
});
