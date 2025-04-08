import type { TRPCRouterRecord } from "@trpc/server";

import { persons } from "./persons/router";
import { schools } from "./schools/router";
import { users } from "./users/router";

export const management = {
  persons,
  schools,
  users,
} satisfies TRPCRouterRecord;
