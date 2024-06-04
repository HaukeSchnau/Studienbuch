import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { defaultTheme, themeSchema } from "@schnau/lib";

import { protectedProcedure, publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

export const schools = createRouter({
  list: publicProcedure.input(z.void()).query(async ({ ctx }) => {
    return ctx.db.school.findMany();
  }),

  setTheme: protectedProcedure
    .input(
      z.object({
        school: z.number(),
        image: z.string().optional(),
        theme: themeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.school.update({
        where: {
          id: input.school,
        },
        data: {
          image: input.image,
          theme: input.theme,
        },
      });
    }),

  getTheme: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    const school = await ctx.db.school.findFirst({
      where: {
        id: input,
      },
      select: {
        theme: true,
        image: true,
      },
    });
    if (!school) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "School not found",
      });
    }

    const parsedTheme = themeSchema.safeParse(school.theme);

    if (!parsedTheme.success) {
      return {
        theme: defaultTheme,
      };
    }

    return {
      theme: parsedTheme.data,
      image: school.image,
    };
  }),
});
