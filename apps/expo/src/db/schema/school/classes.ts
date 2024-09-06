import { relations } from "drizzle-orm";
import {
  foreignKey,
  int,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { Persons } from "../people/persons";
import { SemesterCoursesToClasses } from "./courses";
import { SchoolId } from "./school-id";
import { Years } from "./years";

export const Classes = sqliteTable(
  "classes",
  {
    identifierInYear: text("identifier_in_year").notNull(),

    startYear: int("start_year").notNull(),
    school: SchoolId("school").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.identifierInYear, table.startYear, table.school],
      }),
      year_fk: foreignKey({
        columns: [table.startYear, table.school],
        foreignColumns: [Years.startYear, Years.school],
      })
        .onDelete("restrict")
        .onUpdate("cascade"),
    };
  },
);

export const ClassesRelations = relations(Classes, ({ one, many }) => ({
  year: one(Years, {
    fields: [Classes.startYear, Classes.school],
    references: [Years.startYear, Years.school],
  }),
  teachers: many(TeachersToClasses),
  semesterCourses: many(SemesterCoursesToClasses),
}));

export const TeachersToClasses = sqliteTable(
  "teachers_to_classes",
  {
    teacher: text("teacher")
      .notNull()
      .references(() => Persons.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    classIdentifier: text("class_identifier").notNull(),
    classStartYear: int("class_start_year").notNull(),
    school: SchoolId("school").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [
          table.teacher,
          table.classIdentifier,
          table.classStartYear,
          table.school,
        ],
      }),
      class_fk: foreignKey({
        columns: [table.classIdentifier, table.classStartYear, table.school],
        foreignColumns: [
          Classes.identifierInYear,
          Classes.startYear,
          Classes.school,
        ],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const TeachersToClassesRelations = relations(
  TeachersToClasses,
  ({ one }) => ({
    teacher: one(Persons, {
      fields: [TeachersToClasses.teacher],
      references: [Persons.id],
    }),
    class: one(Classes, {
      fields: [
        TeachersToClasses.classIdentifier,
        TeachersToClasses.classStartYear,
        TeachersToClasses.school,
      ],
      references: [Classes.identifierInYear, Classes.startYear, Classes.school],
    }),
  }),
);
