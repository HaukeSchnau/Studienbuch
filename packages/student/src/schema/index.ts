import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getTableConfig } from "drizzle-orm/sqlite-core";

export * from "./people/persons";

export * from "./school/classes";
export * from "./school/courses";
export * from "./school/schools";
export * from "./school/school-id";
export * from "./school/semesters";
export * from "./school/years";

export * from "./students/absences";
export * from "./students/grades";
export * from "./students/tasks";

export * from "./timetable/substitutions";
export * from "./timetable/timetable-entries";
export * from "./timetable/recurring-timetable-entries";

export * from "./events";

export const pk = <TTable extends SQLiteTable>(table: TTable) => {
  const conf = getTableConfig(table);
  const [pk] = conf.primaryKeys;

  if (pk) {
    return pk.columns;
  }

  const pkCol = conf.columns.find((c) => c.primary);
  if (pkCol) {
    return [pkCol];
  }

  console.error("Table has no primary key");
  throw new Error("Table has no primary key");
};
