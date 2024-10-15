import { primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";

import { Students } from "../people/persons";
import { Courses } from "../school/courses";
import { uuid } from "../utils";

export const CourseMemberships = sqliteTable(
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
