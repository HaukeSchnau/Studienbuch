import type { TRPCRouterRecord } from "@trpc/server";

import { persons } from "./persons/router";
import { schools } from "./schools/router";
import { users } from "./users/router";
import { years } from "./years/router";

export const management = {
  persons,
  schools,
  users,
  years,
} satisfies TRPCRouterRecord;
