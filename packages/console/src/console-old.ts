import { program } from "@commander-js/extra-typings";
import { bootstrapBroadcastAsync } from "@stu/api";
import { alias, and, eq, ne } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";

process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

program.name("console").description("Studienbuch Console").showSuggestionAfterError();

program.command("prune-conflicts").action(async () => {
  const te1 = alias(tables.TimetableEntries, "te1");
  const te2 = alias(tables.TimetableEntries, "te2");
  const course1 = alias(tables.Courses, "course1");
  const course2 = alias(tables.Courses, "course2");
  const coursesToTeachers1 = alias(tables.CoursesToTeachers, "coursesToTeachers1");
  const coursesToTeachers2 = alias(tables.CoursesToTeachers, "coursesToTeachers2");
  // find all courses with the same teacher that have at least one overlapping time
  const conflicts = await db
    .select()
    .from(course1)
    .innerJoin(te1, eq(course1.id, te1.course))
    .innerJoin(coursesToTeachers1, eq(course1.id, coursesToTeachers1.course))
    .innerJoin(coursesToTeachers2, eq(coursesToTeachers1.teacher, coursesToTeachers2.teacher))
    .innerJoin(course2, eq(coursesToTeachers2.course, course2.id))
    .innerJoin(te2, eq(course2.id, te2.course))
    .innerJoin(tables.Persons, eq(coursesToTeachers1.teacher, tables.Persons.id))
    .where(and(eq(te1.start, te2.start), ne(course1.id, course2.id)));

  console.log(conflicts);
  process.exit(0);
});

program.command("bootstrap-broadcast").action(async () => {
  await bootstrapBroadcastAsync();
  process.exit(0);
});

program.parse();
