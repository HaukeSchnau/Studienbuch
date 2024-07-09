import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import { eq } from "@schnau/db";
import { db } from "@schnau/db/client";
import { Substitution } from "@schnau/db/schema";

import { publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

dayjs.extend(utc);

export const substitutions = createRouter({
  get: publicProcedure
    .input(
      z.object({
        date: z.date().optional(),
      }),
    )
    .query(async ({ input }) => {
      return db.query.Substitution.findMany({
        where: eq(
          Substitution.date,
          input.date ?? dayjs.utc().startOf("day").toDate(),
        ),
        with: {
          course: true,
        },
      }).then((substitutions) => {
        return substitutions.map(
          ({ lessonStart, lessonEnd, ...substitution }) => {
            return {
              ...substitution,
              lessonStart: lessonStart >= 8 ? lessonStart - 2 : lessonStart,
              lessonEnd: lessonStart >= 8 ? lessonEnd - 2 : lessonEnd,
            };
          },
        );
      });
    }),
});
