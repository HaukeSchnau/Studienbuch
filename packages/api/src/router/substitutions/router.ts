import type { TRPCRouterRecord } from "@trpc/server";
import { add } from "date-fns";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import { between } from "@stu/db";
import { db } from "@stu/db/client";
import { Substitutions } from "@stu/db/schema";

import { publicProcedure } from "../../procedures";

dayjs.extend(utc);

export const substitutions = {
  get: publicProcedure
    .input(
      z.object({
        date: z.date().optional(),
      }),
    )
    .query(async ({ input }) => {
      const start = input.date ?? dayjs.utc().startOf("day").toDate();
      const end = add(start, { days: 1 });
      return db.query.Substitutions.findMany({
        where: between(Substitutions.start, start, end),
        with: {
          timetableEntry: {
            with: {
              course: true,
            },
          },
        },
      }).then((substitutions) => {
        return substitutions.map(
          ({ timetableEntry: { start, duration }, ...substitution }) => {
            return {
              ...substitution,
              start,
              duration,
            };
          },
        );
      });
    }),
} satisfies TRPCRouterRecord;
