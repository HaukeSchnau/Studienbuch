import { z } from "zod";

import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const schools = createRouter({
  list: publicProcedure.input(z.void()).query(async ({ ctx }) => {
    return ctx.db.school.findMany();
  }),
});
