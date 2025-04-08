import { relations } from "drizzle-orm";
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

export const CourseMembershipsRelations = relations(
  CourseMemberships,
  ({ one }) => ({
    student: one(Students, {
      fields: [CourseMemberships.student],
      references: [Students.person],
    }),
    course: one(Courses, {
      fields: [CourseMemberships.course],
      references: [Courses.id],
    }),
  }),
);
