import { SemesterRepository } from "@stu/db";
import type { TRPCRouterRecord } from "@trpc/server";
import { runtime } from "../../../groundswell";
import { publicProcedure } from "../../../procedures";

export const semesters = {
  getCurrent: publicProcedure.query(() =>
    runtime.runPromise(SemesterRepository.use((repo) => repo.getCurrentSemester)),
  ),
} satisfies TRPCRouterRecord;
