import {
  SHARED_CORE_TABLE_PARITY_CONTRACTS,
  SQLITE_STUDENT_DOMAIN_TABLE_PARITY_CONTRACTS,
  evaluateSchemaParity,
  type SchemaParityActualTable,
} from "@stu/lib";
import { describe, expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/sqlite-core";

import {
  classes,
  courses,
  coursesToClasses,
  coursesToTeachers,
  courseAbsences,
  grades,
  holidays,
  persons,
  recurringTimetableEntries,
  roomChanges,
  schools,
  semesters,
  absenceDays,
  students,
  tasks,
  timetableEntries,
  years,
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
  schools: extractTableMetadata(schools),
  years: extractTableMetadata(years),
  classes: extractTableMetadata(classes),
  semesters: extractTableMetadata(semesters),
  holidays: extractTableMetadata(holidays),
  persons: extractTableMetadata(persons),
  students: extractTableMetadata(students),
  courses: extractTableMetadata(courses),
  courses_to_teachers: extractTableMetadata(coursesToTeachers),
  courses_to_classes: extractTableMetadata(coursesToClasses),
  tasks: extractTableMetadata(tasks),
  timetable_entries: extractTableMetadata(timetableEntries),
  recurring_timetable_entries: extractTableMetadata(recurringTimetableEntries),
  room_changes: extractTableMetadata(roomChanges),
} satisfies Record<(typeof SHARED_CORE_TABLE_PARITY_CONTRACTS)[number]["tableName"], SchemaParityActualTable>;

const studentDomainTableMetadata = {
  grades: extractTableMetadata(grades),
  absence_days: extractTableMetadata(absenceDays),
  course_absences: extractTableMetadata(courseAbsences),
} satisfies Record<(typeof SQLITE_STUDENT_DOMAIN_TABLE_PARITY_CONTRACTS)[number]["tableName"], SchemaParityActualTable>;

describe("schema parity (student)", () => {
  test("shared core schema contracts pass for sqlite tables", () => {
    const parity = evaluateSchemaParity(SHARED_CORE_TABLE_PARITY_CONTRACTS, coreTableMetadata);

    expect(parity.tables.filter((table) => !table.passed)).toEqual([]);
    expect(parity.passed).toBe(true);
  });

  test("student-domain schema contracts pass for sqlite tables", () => {
    const parity = evaluateSchemaParity(SQLITE_STUDENT_DOMAIN_TABLE_PARITY_CONTRACTS, studentDomainTableMetadata);

    expect(parity.tables.filter((table) => !table.passed)).toEqual([]);
    expect(parity.passed).toBe(true);
  });
});
