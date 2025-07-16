import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Classes } from "@stu/db/schema";
import { SCHOOL_IDS } from "@stu/lib";

import { publicProcedure } from "../../../procedures";

export const classes = {
  list: publicProcedure
    .input(z.object({ school: z.enum(SCHOOL_IDS), startYear: z.number() }))
    .query(async ({ input }) => {
      return db.query.Classes.findMany({
        where: and(eq(Classes.school, input.school), eq(Classes.startYear, input.startYear)),
      });
    }),
} satisfies TRPCRouterRecord;
