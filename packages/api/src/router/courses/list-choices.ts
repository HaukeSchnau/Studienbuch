import { z } from "zod";

import type { Salutation, SubjectId } from "@stu/lib";
import { and, eq, gte, lte } from "@stu/db";
import { db } from "@stu/db/client";
import {
  Classes,
  Courses,
  Persons,
  SemesterCourses,
  SemesterCoursesToClasses,
  SemesterCoursesToTeachers,
  Semesters,
} from "@stu/db/schema";
import { SCHOOL_IDS, SEMESTER_TYPES } from "@stu/lib";

import { publicProcedure } from "../../procedures";

export const listChoices = publicProcedure
  .input(
    z.object({
      school: z.enum(SCHOOL_IDS),
      startYear: z.number(),
      semester: z
        .object({
          year: z.number(),
          type: z.enum(SEMESTER_TYPES),
        })
        .optional(),
    }),
  )
  .query(async ({ input }) => {
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
      return {
        type: semester.type,
        year: semester.year,
      };
    })();

    const rows = await db
      .select()
      .from(SemesterCourses)
      .innerJoin(Courses, eq(SemesterCourses.course, Courses.id))
      .innerJoin(
        SemesterCoursesToClasses,
        and(
          eq(SemesterCoursesToClasses.course, SemesterCourses.course),
          eq(
            SemesterCoursesToClasses.semesterType,
            SemesterCourses.semesterType,
          ),
          eq(
            SemesterCoursesToClasses.semesterYear,
            SemesterCourses.semesterYear,
          ),
          eq(SemesterCoursesToClasses.school, SemesterCourses.school),
        ),
      )
      .innerJoin(
        Classes,
        and(
          eq(
            SemesterCoursesToClasses.classIdentifier,
            Classes.identifierInYear,
          ),
          eq(SemesterCoursesToClasses.classStartYear, Classes.startYear),
          eq(SemesterCoursesToClasses.school, Classes.school),
        ),
      )
      .innerJoin(
        Semesters,
        and(
          eq(SemesterCourses.school, Semesters.school),
          eq(Semesters.type, SemesterCourses.semesterType),
          eq(Semesters.year, SemesterCourses.semesterYear),
        ),
      )
      .innerJoin(
        SemesterCoursesToTeachers,
        and(
          eq(SemesterCoursesToTeachers.course, SemesterCourses.course),
          eq(
            SemesterCoursesToTeachers.semesterType,
            SemesterCourses.semesterType,
          ),
          eq(
            SemesterCoursesToTeachers.semesterYear,
            SemesterCourses.semesterYear,
          ),
          eq(SemesterCoursesToTeachers.school, SemesterCourses.school),
        ),
      )
      .innerJoin(Persons, eq(SemesterCoursesToTeachers.teacher, Persons.id))
      .where(
        and(
          eq(SemesterCourses.isMandatory, false),
          eq(SemesterCourses.school, input.school),
          eq(SemesterCourses.semesterYear, semester.year),
          eq(SemesterCourses.semesterType, semester.type),
          eq(Classes.startYear, input.startYear),
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
          isMandatory: row.semester_courses.isMandatory,
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
