import { z } from "zod";

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
    await ingest(
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

    return {
      userId,
    };
  });
