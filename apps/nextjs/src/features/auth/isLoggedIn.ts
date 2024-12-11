import { headers } from "next/headers";
import { z } from "zod";

import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Sessions } from "@stu/db/schema";
import { getCookies } from "@stu/lib-server";

export const isLoggedIn = async () => {
  const cookie = getCookies(await headers(), z.object({ session: z.string() }));
  if (!cookie) {
    return false;
  }

  const session = await db.query.Sessions.findFirst({
    where: eq(Sessions.token, cookie.session),
  });

  return !!session?.user;
};
