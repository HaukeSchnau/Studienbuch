import { z } from "zod";

import { YearModel } from "@acme/db/prisma/zod/year";

import { createTRPCRouter, publicProcedure } from "../trpc";

export const yearsRouter = createTRPCRouter({
  get: publicProcedure
    .meta({ openapi: { method: "GET", path: "/years" } })
    .input(z.void())
    .output(z.array(YearModel))
    .query(async ({ ctx }) => {
      return ctx.prisma.year.findMany();
    }),
});
