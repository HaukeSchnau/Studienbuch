import type { TRPCRouterRecord } from "@trpc/server";

import { join } from "./join";
import { listChoices } from "./list-choices";

export const courses = {
  listChoices,
  join,
} satisfies TRPCRouterRecord;
