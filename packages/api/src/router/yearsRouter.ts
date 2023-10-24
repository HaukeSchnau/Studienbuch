import { z } from "zod";

import { YearModel } from "@acme/db/prisma/zod/year";

import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

const getYearNumber = (startYear: number) => {
  const now = new Date();
  const currentYear = now.getFullYear();

  if (now.getMonth() < 8) {
    return currentYear - startYear + 5 - 1;
  }

  return currentYear - startYear + 5;
};

export const yearsRouter = createRouter({
  get: publicProcedure
    .meta({ openapi: { method: "GET", path: "/years" } })
    .input(z.void())
    .output(z.array(YearModel.omit({ createdAt: true })))
    .query(async ({ ctx }) => {
      return ctx.db.year
        .findMany()
        .then((years) =>
          years.filter((year) => getYearNumber(year.startYear) <= 13),
        );
    }),
});
