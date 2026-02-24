import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Classes, Courses, CoursesToClasses, CoursesToTeachers, Persons, Semesters } from "@stu/db/schema";
import type { Course, WithTeachers } from "@stu/lib";
import { SCHOOL_IDS, Semester } from "@stu/lib";
import { z } from "zod";
import { runtime } from "../../../groundswell";
import { publicProcedure } from "../../../procedures";

export const listChoices = publicProcedure
  .input(
    z.object({
      class: z.object({
        identifierInYear: z.string(),
        startYear: z.number(),
        school: z.enum(SCHOOL_IDS),
      }),
      semester: z
        .object({
          type: z.enum(["SUMMER", "WINTER"]),
          year: z.number(),
        })
        .optional(),
    }),
  )
  .query(async ({ input }) => {
    const {
      class: { identifierInYear, startYear, school },
    } = input;

    const semester = await runtime.runPromise(Semester.current);
    if (!semester) {
      throw new Error("No current semester found");
    }

    const rows = await db
      .select()
      .from(Courses)
      .innerJoin(CoursesToClasses, eq(CoursesToClasses.course, Courses.id))
      .innerJoin(
        Classes,
        and(
          eq(CoursesToClasses.classIdentifier, Classes.identifierInYear),
          eq(CoursesToClasses.classStartYear, Classes.startYear),
          eq(CoursesToClasses.school, Classes.school),
        ),
      )
      .innerJoin(
        Semesters,
        and(
          eq(Semesters.school, Courses.school),
          eq(Semesters.type, Courses.semesterType),
          eq(Semesters.year, Courses.semesterYear),
        ),
      )
      .innerJoin(CoursesToTeachers, eq(CoursesToTeachers.course, Courses.id))
      .innerJoin(Persons, eq(CoursesToTeachers.teacher, Persons.id))
      .where(
        and(
          eq(Courses.isMandatory, false),
          eq(Courses.school, school),
          eq(Courses.semesterYear, semester.year),
          eq(Courses.semesterType, semester.type),
          eq(Classes.startYear, startYear),
          eq(Classes.identifierInYear, identifierInYear),
        ),
      );

    const result = new Map<string, Course & WithTeachers>();

    for (const row of rows) {
      if (!result.has(row.courses.id)) {
        result.set(row.courses.id, {
          id: row.courses.id,
          isMandatory: row.courses.isMandatory,
          name: row.courses.name,
          subject: row.courses.subject,
          teachers: [],
        });
      }

      // oxlint-disable-next-line typescript/no-non-null-assertion -- We ensure that the course is in the map above
      const course = result.get(row.courses.id)!;
      course.teachers.push({
        abbrv: row.persons.abbrv,
        id: row.persons.id,
        firstName: row.persons.firstName,
        lastName: row.persons.lastName,
        salutation: row.persons.salutation,
      });
    }

    return {
      semester,
      courses: Array.from(result.values()),
    };
  });
