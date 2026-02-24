import { and, asc, desc, eq, gt, gte, lt, lte } from "@stu/db";
import { db } from "@stu/db/client";
import { Semesters, Years } from "@stu/db/schema";
import { SCHOOL_IDS } from "@stu/lib";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const yearsSchema = createInsertSchema(Years);
const defaultSemesterSchool: (typeof SCHOOL_IDS)[number] = "igs-lil";

export const listYearsInputSchema = z.object({
  school: z.enum(SCHOOL_IDS).optional(),
  activeOnly: z.boolean().optional(),
});

export const yearIdInputSchema = z.object({
  school: z.enum(SCHOOL_IDS),
  startYear: z.number(),
});

export const addYearInputSchema = yearsSchema;
export const updateYearInputSchema = yearsSchema.partial().required({ school: true, startYear: true });

export type ListYearsInput = z.infer<typeof listYearsInputSchema>;
export type YearIdInput = z.infer<typeof yearIdInputSchema>;
export type AddYearInput = z.infer<typeof addYearInputSchema>;
export type UpdateYearInput = z.infer<typeof updateYearInputSchema>;

const findCurrentOrUpcomingSemester = async () => {
  const today = new Date();

  const current = await db.query.Semesters.findFirst({
    where: and(
      lte(Semesters.start, today),
      gte(Semesters.end, today),
      eq(Semesters.school, defaultSemesterSchool),
    ),
  });

  if (current) {
    return current;
  }

  const next = await db.query.Semesters.findFirst({
    where: and(gte(Semesters.start, today), eq(Semesters.school, defaultSemesterSchool)),
    orderBy: [asc(Semesters.start)],
  });

  if (next) {
    return next;
  }

  return db.query.Semesters.findFirst({
    where: eq(Semesters.school, defaultSemesterSchool),
    orderBy: [desc(Semesters.start)],
  });
};

const listActiveYears = async () => {
  const semester = await findCurrentOrUpcomingSemester();

  if (!semester) {
    return [];
  }

  return db
    .select({
      school: Years.school,
      name: Years.name,
      startYear: Years.startYear,
      graduationYear: Years.graduationYear,
    })
    .from(Years)
    .where(
      and(
        eq(Years.school, semester.school),
        semester.type === "WINTER" ? lte(Years.startYear, semester.year) : lt(Years.startYear, semester.year),
        semester.type === "SUMMER"
          ? gte(Years.graduationYear, semester.year)
          : gt(Years.graduationYear, semester.year),
      ),
    );
};

export const listYears = async (input: ListYearsInput) => {
  if (input.activeOnly) {
    return listActiveYears();
  }

  return db.query.Years.findMany({
    where: input.school ? eq(Years.school, input.school) : undefined,
  });
};

export const getOneYear = async (input: YearIdInput) => {
  return db.query.Years.findFirst({
    where: and(eq(Years.school, input.school), eq(Years.startYear, input.startYear)),
  });
};

export const addYear = async (input: AddYearInput) => {
  return db.insert(Years).values(input);
};

export const updateYear = async (input: UpdateYearInput) => {
  return db
    .update(Years)
    .set(input)
    .where(and(eq(Years.school, input.school), eq(Years.startYear, input.startYear)));
};
