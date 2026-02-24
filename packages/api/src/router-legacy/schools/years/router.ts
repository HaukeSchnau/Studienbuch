import { type Year, SCHOOL_IDS } from "@stu/lib";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../../../procedures";

const webServicesModuleUrl = new URL("../../../../../lib-server/src/web-services.ts", import.meta.url).href;

const listYearsInputSchema = z.object({
  school: z.enum(SCHOOL_IDS).optional(),
  activeOnly: z.boolean().optional(),
});

const yearIdInputSchema = z.object({
  school: z.enum(SCHOOL_IDS),
  startYear: z.number(),
});

type ListYearsInput = z.infer<typeof listYearsInputSchema>;
type YearIdInput = z.infer<typeof yearIdInputSchema>;

const loadYearsServices = async () => {
  return (await import(webServicesModuleUrl)) as {
    listYears: (input: ListYearsInput) => Promise<Year[]>;
    getOneYear: (input: YearIdInput) => Promise<Year | null>;
  };
};

export const years = {
  list: publicProcedure.input(listYearsInputSchema).query(async ({ input }) => (await loadYearsServices()).listYears(input)),

  getOne: publicProcedure.input(yearIdInputSchema).query(async ({ input }) => {
    const year = await (await loadYearsServices()).getOneYear(input);

    if (!year) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Year not found",
      });
    }

    return year;
  }),
} satisfies TRPCRouterRecord;
