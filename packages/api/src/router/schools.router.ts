import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure } from "../procedures/protectedProcedure";
import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

const themeSchema = z.object({
  primary: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    text: z.string(),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
    pale: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  accent: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    sec: z.object({
      color: z.string(),
      on: z.string(),
    }),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
    pale: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  danger: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
    sec: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  alert: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  success: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
    pale: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  neutral: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    sec: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  surface: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  background: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
});

type Theme = z.infer<typeof themeSchema>;

export const schools = createRouter({
  list: publicProcedure.input(z.void()).query(async ({ ctx }) => {
    return ctx.db.school.findMany();
  }),

  setTheme: protectedProcedure
    .input(
      z.object({
        school: z.number(),
        image: z.string(),
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

    return {
      theme: themeSchema.parse(school.theme),
      image: school.image,
    };
  }),
});
