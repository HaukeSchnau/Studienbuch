import { evaluateSchemaParity, SHARED_CORE_TABLE_PARITY_CONTRACTS, type SchemaParityActualTable } from "@stu/lib";
import { describe, expect, test } from "bun:test";
import { getTableConfig } from "drizzle-orm/pg-core";

import {
  Classes,
  Courses,
  CoursesToClasses,
  CoursesToTeachers,
  Persons,
  RecurringTimetableEntries,
  RoomChanges,
  Schools,
  Semesters,
  Students,
  Tasks,
  TimetableEntries,
  Years,
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

describe("schema parity (db)", () => {
  test("shared core schema contracts pass for postgres tables", () => {
    const parity = evaluateSchemaParity(SHARED_CORE_TABLE_PARITY_CONTRACTS, coreTableMetadata);

    expect(parity.tables.filter((table) => !table.passed)).toEqual([]);
    expect(parity.passed).toBe(true);
  });
});
