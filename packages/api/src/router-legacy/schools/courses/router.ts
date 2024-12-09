import type { TRPCRouterRecord } from "@trpc/server";

import { listChoices } from "./list-choices";

export const courses = {
  listChoices,
} satisfies TRPCRouterRecord;
