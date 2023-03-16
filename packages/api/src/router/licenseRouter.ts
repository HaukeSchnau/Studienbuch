import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "../trpc";

export const licenseRouter = createTRPCRouter({
  check: publicProcedure
    .meta({ openapi: { method: "GET", path: "/licenses/check" } })
    .input(
      z.object({
        licenseKey: z.string(),
      }),
    )
    .output(z.enum(["INVALID", "EXPIRED", "ACTIVATED", "VALID"] as const))
    .query(async ({ ctx, input }) => {
      const licenseKey = await ctx.prisma.licenseKey.findFirst({
        where: { key: input.licenseKey },
      });
      if (!licenseKey) {
        return "INVALID" as const;
      }
      console.log(licenseKey);
      if (licenseKey.isSuperKey) {
        return "VALID" as const;
      }
      if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
        return "EXPIRED" as const;
      }
      if (licenseKey.activatedAt) {
        return "ACTIVATED" as const;
      }
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
      const licenseKey = await ctx.prisma.licenseKey.findFirst({
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
      if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "License key expired",
        });
      }
      if (licenseKey.activatedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "License key already activated",
        });
      }
      await ctx.prisma.licenseKey.update({
        where: { id: licenseKey.id },
        data: { activatedAt: new Date() },
      });
    }),
});
