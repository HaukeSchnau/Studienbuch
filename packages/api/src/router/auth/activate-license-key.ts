import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Result } from "@stu/lib";

import { publicProcedure } from "../../procedures";
import { ingest } from "../events/ingest";

export const activateLicenseKey = publicProcedure
  .input(
    z.object({
      licenseKey: z.string(),
    }),
  )
  .mutation(async ({ input }) => {
    const userId = crypto.randomUUID();
    const res = await ingest(
      "auth.licenseActivated",
      {
        data: {
          licenseKey: input.licenseKey,
          userId,
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
      userId,
    );

    if (Result.isErr(res)) {
      console.error(res);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: res.error,
      });
    }

    return {
      userId,
    };
  });
