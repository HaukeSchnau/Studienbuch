import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Class } from "@stu/db/schema";
import { z } from "zod";

import { publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

export const classes = createRouter({
  list: publicProcedure
    .input(z.object({ yearId: z.number() }))
    .query(async ({ input }) => {
      return db.query.Class.findMany({
        where: eq(Class.yearId, input.yearId),
        with: {
          courses: {
            with: {
              teacher: true,
              times: true,
            },
          },
        },
      });
    }),
});
