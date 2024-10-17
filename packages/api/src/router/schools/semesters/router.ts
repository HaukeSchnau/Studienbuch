import type { TRPCRouterRecord } from "@trpc/server";

import { and, gte, lte } from "@stu/db";
import { db } from "@stu/db/client";
import { Semesters } from "@stu/db/schema";

import { publicProcedure } from "../../../procedures";

export const semesters = {
  getCurrent: publicProcedure.query(async () => {
    const today = new Date();
    const semester = await db.query.Semesters.findFirst({
      where: and(lte(Semesters.start, today), gte(Semesters.end, today)),
    });
    if (!semester) {
      throw new Error("No current semester found");
    }
    return semester;
  }),
} satisfies TRPCRouterRecord;
