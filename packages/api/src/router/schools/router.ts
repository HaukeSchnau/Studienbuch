import { SCHOOL_IDS } from "@stu/lib";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure } from "../../procedures";
import { classes } from "../../router-legacy/schools/classes/router";
import { courses } from "../../router-legacy/schools/courses/router";
import { semesters } from "../../router-legacy/schools/semesters/router";
import { years } from "../../router-legacy/schools/years/router";

const webServicesModuleUrl = new URL("../../../../lib-server/src/web-services.ts", import.meta.url).href;
const schoolIdInputSchema = z.enum(SCHOOL_IDS);

type SchoolIdInput = z.infer<typeof schoolIdInputSchema>;

const loadSchoolServices = async () => {
  return (await import(webServicesModuleUrl)) as {
    listSchools: () => Promise<unknown>;
    findSchoolTheme: (schoolId: SchoolIdInput) => Promise<{ theme: unknown; image?: string | null } | null>;
  };
};

export const schools = {
  classes,
  courses,
  semesters,
  years,

  list: publicProcedure.input(z.void()).query(async () => (await loadSchoolServices()).listSchools()),

  getTheme: publicProcedure.input(schoolIdInputSchema).query(async ({ input }) => {
    const school = await (await loadSchoolServices()).findSchoolTheme(input);

    if (!school) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "School not found",
      });
    }

    return school;
  }),
} satisfies TRPCRouterRecord;
