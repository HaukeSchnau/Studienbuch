import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { getCookies } from "@schnau/auth/src/cookies";
import { decodeJwt } from "@schnau/auth/src/jwt";

export const isLoggedIn = cache(() => {
  const cookie = getCookies(headers(), z.object({ jwt: z.string() }));
  if (!cookie) {
    return false;
  }

  const decoded = decodeJwt(cookie.jwt);

  return !!decoded?.user;
});
