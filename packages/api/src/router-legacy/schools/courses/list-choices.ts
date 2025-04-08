import { z } from "zod";

import type { Course, WithTeachers } from "@stu/lib";
import { and, eq, gte, lte } from "@stu/db";
import { db } from "@stu/db/client";
import {
  Classes,
  Courses,
  CoursesToClasses,
  CoursesToTeachers,
  Persons,
  Semesters,
} from "@stu/db/schema";
import { SCHOOL_IDS } from "@stu/lib";

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

    const semester = await (async () => {
      if (input.semester) {
        return input.semester;
      }

      const today = new Date();
      const semester = await db.query.Semesters.findFirst({
        where: and(lte(Semesters.start, today), gte(Semesters.end, today)),
      });
      if (!semester) {
        throw new Error("No current semester found");
      }

      return semester;
    })();

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
          longName: row.courses.longName,
          name: row.courses.name,
          subject: row.courses.subject,
          teachers: [],
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
