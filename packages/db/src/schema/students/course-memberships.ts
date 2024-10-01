import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

import { Students } from "../people/persons";
import { Courses } from "../school/courses";

export const CourseMemberships = pgTable(
  "course_memberships",
  {
    student: uuid("student")
      .notNull()
      .references(() => Students.person, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    course: uuid("course")
      .notNull()
      .references(() => Courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.student, table.course],
      }),
    };
  },
);
