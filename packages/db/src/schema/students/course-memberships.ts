import {
  foreignKey,
  pgTable,
  primaryKey,
  smallint,
  uuid,
} from "drizzle-orm/pg-core";

import { Students } from "../people/persons";
import { SemesterCourses } from "../school/courses";
import { SchoolId } from "../school/school-id";
import { SemesterType } from "../school/semesters";

export const CourseMemberships = pgTable(
  "course_memberships",
  {
    student: uuid("student")
      .notNull()
      .references(() => Students.person, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    course: uuid("course").notNull(),
    semesterType: SemesterType("semester_type").notNull(),
    semesterYear: smallint("semester_year").notNull(),
    school: SchoolId("school").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [
          table.student,
          table.course,
          table.semesterType,
          table.semesterYear,
          table.school,
        ],
      }),
      semester_course_fk: foreignKey({
        columns: [
          table.course,
          table.semesterType,
          table.semesterYear,
          table.school,
        ],
        foreignColumns: [
          SemesterCourses.course,
          SemesterCourses.semesterType,
          SemesterCourses.semesterYear,
          SemesterCourses.school,
        ],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);
