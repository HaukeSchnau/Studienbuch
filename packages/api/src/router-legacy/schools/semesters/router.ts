import { SemesterRepository } from "@stu/lib";
import type { TRPCRouterRecord } from "@trpc/server";
import { Effect } from "effect";
import { runtime } from "../../../groundswell";
import { publicProcedure } from "../../../procedures";

export const semesters = {
  getCurrent: publicProcedure.query(() =>
    runtime.runPromise(Effect.andThen(SemesterRepository, (repo) => repo.getCurrentSemester())),
  ),
} satisfies TRPCRouterRecord;
