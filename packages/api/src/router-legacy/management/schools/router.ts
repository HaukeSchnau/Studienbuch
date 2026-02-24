import { SCHOOL_IDS, themeSchema } from "@stu/lib";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure } from "../../../procedures";
const webServicesModuleUrl = new URL("../../../../../lib-server/src/web-services.ts", import.meta.url).href;

const setSchoolThemeInputSchema = z.object({
  school: z.enum(SCHOOL_IDS),
  image: z.string().optional(),
  theme: themeSchema,
});

type SetSchoolThemeInput = z.infer<typeof setSchoolThemeInputSchema>;

const loadSchoolServices = async () => {
  return (await import(webServicesModuleUrl)) as {
    setSchoolTheme: (input: SetSchoolThemeInput) => Promise<unknown>;
  };
};

export const schools = {
  setTheme: protectedProcedure
    .input(setSchoolThemeInputSchema)
    .mutation(async ({ input }) => (await loadSchoolServices()).setSchoolTheme(input)),
} satisfies TRPCRouterRecord;
