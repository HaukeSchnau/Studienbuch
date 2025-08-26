import { Semester } from "@stu/lib";
import type { TRPCRouterRecord } from "@trpc/server";
import { runtime } from "../../../groundswell";
import { publicProcedure } from "../../../procedures";

export const semesters = {
  getCurrent: publicProcedure.query(() => runtime.runPromise(Semester.current)),
} satisfies TRPCRouterRecord;
