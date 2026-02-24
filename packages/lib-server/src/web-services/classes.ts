import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Classes } from "@stu/db/schema";
import { SCHOOL_IDS } from "@stu/lib";
import { z } from "zod";

export const listClassesByYearInputSchema = z.object({
  school: z.enum(SCHOOL_IDS),
  startYear: z.number(),
});

export type ListClassesByYearInput = z.infer<typeof listClassesByYearInputSchema>;

export const listClassesByYear = async (input: ListClassesByYearInput) => {
  return db.query.Classes.findMany({
    where: and(eq(Classes.school, input.school), eq(Classes.startYear, input.startYear)),
  });
};
