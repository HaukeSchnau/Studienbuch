import {
  POSTGRES_INTENTIONALLY_DIVERGENT_TABLES,
  POSTGRES_SUBSTITUTIONS_TABLE_PARITY_CONTRACTS,
  POSTGRES_STUDENT_DOMAIN_TABLE_PARITY_CONTRACTS,
  SHARED_CORE_TABLE_PARITY_CONTRACTS,
  evaluateSchemaParity,
  type SchemaParityActualTable,
} from "@stu/lib";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import {
  Classes,
  Courses,
  CoursesToClasses,
  CoursesToTeachers,
  CourseAbsences,
  Grades,
  holidays,
  Persons,
  RecurringTimetableEntries,
  RoomChanges,
  Schools,
  Semesters,
  AbsenceDays,
  Substitutions,
  Students,
  Tasks,
  TimetableEntries,
  Years,
  CourseMemberships,
  Rooms,
} from "./schema";

const extractPrimaryKeyColumns = (tableConfig: {
  primaryKeys: Array<{ columns: Array<{ name: string }> }>;
  columns: Array<{ name: string; primary: boolean }>;
}) => {
  const [primaryKey] = tableConfig.primaryKeys;
  if (primaryKey) {
    return primaryKey.columns.map((column) => column.name);
  }

  return tableConfig.columns.filter((column) => column.primary).map((column) => column.name);
};

const extractTableMetadata = (table: Parameters<typeof getTableConfig>[0]): SchemaParityActualTable => {
  const tableConfig = getTableConfig(table);

  return {
    columns: tableConfig.columns.map((column) => column.name),
    primaryKeyColumns: extractPrimaryKeyColumns(tableConfig),
  };
};

const coreTableMetadata = {
  schools: extractTableMetadata(Schools),
  years: extractTableMetadata(Years),
  classes: extractTableMetadata(Classes),
  semesters: extractTableMetadata(Semesters),
  holidays: extractTableMetadata(holidays),
  persons: extractTableMetadata(Persons),
  students: extractTableMetadata(Students),
  courses: extractTableMetadata(Courses),
  courses_to_teachers: extractTableMetadata(CoursesToTeachers),
  courses_to_classes: extractTableMetadata(CoursesToClasses),
  tasks: extractTableMetadata(Tasks),
  timetable_entries: extractTableMetadata(TimetableEntries),
  recurring_timetable_entries: extractTableMetadata(RecurringTimetableEntries),
  room_changes: extractTableMetadata(RoomChanges),
} satisfies Record<(typeof SHARED_CORE_TABLE_PARITY_CONTRACTS)[number]["tableName"], SchemaParityActualTable>;

const studentDomainTableMetadata = {
  grades: extractTableMetadata(Grades),
  absence_days: extractTableMetadata(AbsenceDays),
  course_absences: extractTableMetadata(CourseAbsences),
} satisfies Record<
  (typeof POSTGRES_STUDENT_DOMAIN_TABLE_PARITY_CONTRACTS)[number]["tableName"],
  SchemaParityActualTable
>;

const substitutionsTableMetadata = {
  substitutions: extractTableMetadata(Substitutions),
} satisfies Record<
  (typeof POSTGRES_SUBSTITUTIONS_TABLE_PARITY_CONTRACTS)[number]["tableName"],
  SchemaParityActualTable
>;

const postgresAllowlistTableMetadata = {
  rooms: extractTableMetadata(Rooms),
  course_memberships: extractTableMetadata(CourseMemberships),
} satisfies Record<(typeof POSTGRES_INTENTIONALLY_DIVERGENT_TABLES)[number], SchemaParityActualTable>;

describe("schema parity (db)", () => {
  test("shared core schema contracts pass for postgres tables", () => {
    const parity = evaluateSchemaParity(SHARED_CORE_TABLE_PARITY_CONTRACTS, coreTableMetadata);

    expect(parity.tables.filter((table) => !table.passed)).toEqual([]);
    expect(parity.passed).toBe(true);
  });

  test("student-domain schema contracts pass for postgres tables", () => {
    const parity = evaluateSchemaParity(POSTGRES_STUDENT_DOMAIN_TABLE_PARITY_CONTRACTS, studentDomainTableMetadata);

    expect(parity.tables.filter((table) => !table.passed)).toEqual([]);
    expect(parity.passed).toBe(true);
  });

  test("substitutions schema contracts pass for postgres tables", () => {
    const parity = evaluateSchemaParity(POSTGRES_SUBSTITUTIONS_TABLE_PARITY_CONTRACTS, substitutionsTableMetadata);

    expect(parity.tables.filter((table) => !table.passed)).toEqual([]);
    expect(parity.passed).toBe(true);
  });

  test("one-sided allowlist tables stay covered for postgres", () => {
    const allowlistNames = [...POSTGRES_INTENTIONALLY_DIVERGENT_TABLES];

    expect(allowlistNames.every((tableName) => tableName in postgresAllowlistTableMetadata)).toBe(true);
    expect(
      (
        Object.keys(postgresAllowlistTableMetadata) as Array<(typeof POSTGRES_INTENTIONALLY_DIVERGENT_TABLES)[number]>
      ).every((tableName) => allowlistNames.includes(tableName)),
    ).toBe(true);
  });
});
