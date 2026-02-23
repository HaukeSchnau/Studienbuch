import type { TRPCRouterRecord } from "@trpc/server";

import { persons } from "../../router-legacy/management/persons/router";
import { schools } from "../../router-legacy/management/schools/router";
import { users } from "../../router-legacy/management/users/router";

export const management = {
  persons,
  schools,
  users,
} satisfies TRPCRouterRecord;
