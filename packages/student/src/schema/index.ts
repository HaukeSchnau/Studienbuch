import { ClientStorage } from "@groundswell/adapter-drizzle-sqlite";

export * from "./people/persons";

export * from "./school/classes";
export * from "./school/courses";
export * from "./school/school-id";
export * from "./school/schools";
export * from "./school/semesters";
export * from "./school/years";

export * from "./students/absences";
export * from "./students/grades";
export * from "./students/tasks";
export * from "./timetable/recurring-timetable-entries";
export * from "./timetable/substitutions";
export * from "./timetable/timetable-entries";

export const eventLog = ClientStorage.EventsTable;
