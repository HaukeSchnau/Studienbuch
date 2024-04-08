import { z } from "zod";

import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const schools = createRouter({
  list: publicProcedure.input(z.void()).query(async ({ ctx }) => {
    return ctx.db.school.findMany();
  }),

  getTheme: publicProcedure.input(z.number()).query(async ({ ctx, input }) => {
    // return ctx.db.theme.findFirst({
    //   where: {
    //     schoolId: input,
    //   },
    // });

    return {
      primary: {
        default: { color: "#33A42B", on: "#ffffff" },
        text: "#098A00",
        des: { color: "#EEF5ED", on: "#000000" },
        pale: { color: "#6DB868", on: "#000000" },
      },
      accent: {
        default: {
          color: "#3B7FD9",
          on: "#ffffff",
        },
        sec: {
          color: "#4d75a8",
          on: "#ffffff",
        },
        des: {
          color: "#EBF0F7",
          on: "#000000",
        },
        pale: {
          color: "#76A6E5",
          on: "#000000",
        },
      },
      danger: {
        default: {
          color: "#A42B33",
          on: "#ffffff",
        },
        des: {
          color: "#ECD4D6",
          on: "#000000",
        },
        sec: {
          color: "#8A0000",
          on: "#ffffff",
        },
      },
      alert: {
        default: {
          color: "#DCAB3C",
          on: "#ffffff",
        },
        des: {
          color: "#F2E9D8",
          on: "#000000",
        },
      },
      success: {
        default: { color: "#33A42B", on: "#ffffff" },
        des: { color: "#EEF5ED", on: "#000000" },
        pale: { color: "#6DB868", on: "#000000" },
      },
      neutral: {
        default: {
          color: "#666666",
          on: "#ffffff",
        },
        sec: {
          color: "#e5e5e5",
          on: "#ffffff",
        },
      },
      surface: {
        default: {
          color: "#ffffff",
          on: "#000000",
        },
      },
      background: {
        default: {
          color: "#f9f9f9",
          on: "#000000",
        },
      },
    };
  }),
});
