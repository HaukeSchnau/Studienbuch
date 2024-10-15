import { z } from "zod";

import type { Salutation, SubjectId } from "@stu/lib";
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

import { publicProcedure } from "../../procedures";

export const listChoices = publicProcedure
  .input(
    z.object({
      school: z.enum(SCHOOL_IDS),
      startYear: z.number(),
      identifierInYear: z.string(),
    }),
  )
  .query(async ({ input }) => {
    const today = new Date();
    const semester = await db.query.Semesters.findFirst({
      where: and(lte(Semesters.start, today), gte(Semesters.end, today)),
      columns: { type: true, year: true },
    });
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
          eq(Courses.school, input.school),
          eq(Courses.semesterYear, semester.year),
          eq(Courses.semesterType, semester.type),
          eq(Classes.startYear, input.startYear),
          eq(Classes.identifierInYear, input.identifierInYear),
        ),
      );

    const result = new Map<
      string,
      {
        id: string;
        name: string;
        subject: SubjectId;
        isMandatory: boolean;
        teachers: {
          id: string;
          name: string;
          abbrv: string | null;
          salutation: Salutation | null;
        }[];
        classes: {
          identifierInYear: string;
          startYear: number;
          school: string;
        }[];
        semesterType: string;
        semesterYear: number;
      }
    >();

    for (const row of rows) {
      if (!result.has(row.courses.id)) {
        result.set(row.courses.id, {
          classes: [],
          id: row.courses.id,
          isMandatory: row.courses.isMandatory,
          name: row.courses.name,
          semesterType: row.semesters.type,
          semesterYear: row.semesters.year,
          subject: row.courses.subject,
          teachers: [],
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const course = result.get(row.courses.id)!;
      course.classes.push({
        identifierInYear: row.classes.identifierInYear,
        school: row.classes.school,
        startYear: row.classes.startYear,
      });
      course.teachers.push({
        abbrv: row.persons.abbrv,
        id: row.persons.id,
        name: row.persons.name,
        salutation: row.persons.salutation,
      });
    }

    return Array.from(result.values());
  });
