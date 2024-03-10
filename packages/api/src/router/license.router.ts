import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure } from "../procedures/publicProcedure";
import { createRouter } from "../trpc";

export const license = createRouter({
  check: publicProcedure
    .meta({ openapi: { method: "GET", path: "/licenses/check" } })
    .input(
      z.object({
        licenseKey: z.string(),
      }),
    )
    .output(z.enum(["INVALID", "EXPIRED", "ACTIVATED", "VALID"] as const))
    .query(async ({ ctx, input }) => {
      const licenseKey = await ctx.db.licenseKey.findFirst({
        where: { key: input.licenseKey },
      });
      if (!licenseKey) {
        return "INVALID" as const;
      }
      // TODO restore old logic once logout bug is fixed
      // if (licenseKey.isSuperKey) {
      //   return "VALID" as const;
      // }
      // if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
      //   return "EXPIRED" as const;
      // }
      // if (licenseKey.activatedAt) {
      //   return "ACTIVATED" as const;
      // }
      return "VALID" as const;
    }),
  activate: publicProcedure
    .meta({ openapi: { method: "POST", path: "/licenses/activate" } })
    .input(
      z.object({
        licenseKey: z.string(),
      }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      const licenseKey = await ctx.db.licenseKey.findFirst({
        where: { key: input.licenseKey },
      });
      if (!licenseKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "License key not found",
        });
      }
      if (licenseKey.isSuperKey) {
        return;
      }
      // if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
      //   throw new TRPCError({
      //     code: "BAD_REQUEST",
      //     message: "License key expired",
      //   });
      // }
      // if (licenseKey.activatedAt) {
      //   throw new TRPCError({
      //     code: "BAD_REQUEST",
      //     message: "License key already activated",
      //   });
      // }
      await ctx.db.licenseKey.update({
        where: { id: licenseKey.id },
        data: { activatedAt: new Date() },
      });
    }),
});
