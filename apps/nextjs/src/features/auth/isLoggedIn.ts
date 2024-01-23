import { headers } from "next/headers";
import { z } from "zod";

import { getCookies } from "@schnau/common/src/cookies";

export const isLoggedIn = () => {
  const cookie = getCookies(headers(), z.object({ session: z.string() }));
  return !!cookie?.session;
};
