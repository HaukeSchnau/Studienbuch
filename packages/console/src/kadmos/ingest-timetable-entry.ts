import { ingestEffect, SYSTEM_USER } from "@stu/api";
import { and, Database, eq } from "@stu/db";
import * as tables from "@stu/db/schema";
import type { SchoolId, SubjectId } from "@stu/lib";
import { subjectNameMap } from "@stu/lib";
import { sendNotifications } from "@stu/lib-server";
import { format } from "date-fns";
import { Effect } from "effect";
import { getTeacherIdByAbbrv } from "~/util";
import { logger } from "../logger";

interface Entry {
  uuid: string;
  course: {
    name: string;
    subject: SubjectId;
  };
  classes: {
    identifierInYear: string;
    startYear: number;
  }[];
  teacherNames: string[];
  semester: {
    type: "WINTER" | "SUMMER";
    year: number;
  };
  school: SchoolId;
  start: Date;
  duration: number;
  roomNumbers: string[];
  substitutions: (
    | {
        type: "SUBSTITUTION";
        originalTeacherName: string;
        substituteName: string;
      }
    | {
        type: "ABSENT";
        originalTeacherName: string;
        substituteName?: never;
      }
  )[];
}

export const ingestTimetableEntry = Effect.fn(function* ({
  uuid,
  course,
  semester,
  classes,
  teacherNames,
  school,
  start,
  duration,
  roomNumbers,
  substitutions,
}: Entry) {
  yield* ingestEffect(
    {
      type: "org.courses.created",
      data: {
        id: uuid,
        name: course.name,
        subject: course.subject,
        isMandatory: false,
        school,
        semester,
        classes: classes.map((cls) => ({
          identifierInYear: cls.identifierInYear,
          startYear: cls.startYear,
        })),
        teachers: yield* Effect.all(teacherNames.map((teacher) => getTeacherIdByAbbrv(teacher))),
      },
    },
    SYSTEM_USER,
  ).pipe(
    Effect.tap(() => Effect.logInfo(`Course ${course.name} created!`)),
    Effect.catchIf(
      (error) => error.reason === "DUPLICATE",
      () => Effect.logDebug(`Course ${course.name} already created!`),
    ),
    Effect.catchAll((err) =>
      Effect.logError(`Could not ingest course created event for ${course.name}: ${err.toString()}`),
    ),
  );

  const db = yield* Database;
  const existingTimetableEntry = yield* db.execute((db) =>
    db.query.TimetableEntries.findFirst({
      where: and(eq(tables.TimetableEntries.course, uuid), eq(tables.TimetableEntries.start, start)),
    }),
  );

  // TODO: Ensure that entries are merged before this stage --> then check for equality here
  if (
    !existingTimetableEntry ||
    existingTimetableEntry.duration < duration ||
    roomNumbers.some((room) => !existingTimetableEntry.rooms.includes(room))
  ) {
    yield* ingestEffect(
      {
        type: "org.timetable.entryCreated",
        data: {
          course: uuid,
          start: start,
          duration: duration,
          rooms: roomNumbers,
        },
      },
      SYSTEM_USER,
    ).pipe(
      Effect.tapError((err) =>
        Effect.logError(`Could not ingest timetable entry created event for ${course.name}: ${err.toString()}`),
      ),
    );

    if (existingTimetableEntry) {
      logger.info(
        `Timetable entry updated for ${course.name}!\n${JSON.stringify(existingTimetableEntry, null, 2)}\n${JSON.stringify(
          {
            course: uuid,
            start: start,
            duration: duration,
            rooms: roomNumbers,
          },
          null,
          2,
        )}`,
      );
    } else {
      logger.info(`Timetable entry created for ${course.name} on ${start.toISOString()}!`);
    }
  }

  for (const substitution of substitutions) {
    const studentsWithExplicitMembership = yield* db.execute((db) =>
      db
        .select({
          studentId: tables.CourseMemberships.student,
          notificationTokens: tables.Users.notificationTokens,
        })
        .from(tables.CourseMemberships)
        .innerJoin(tables.Users, eq(tables.CourseMemberships.student, tables.Users.id))
        .where(eq(tables.CourseMemberships.course, uuid)),
    );

    const studentsWithImplicitMembership = yield* db.execute((db) =>
      db
        .select({
          studentId: tables.Users.id,
          notificationTokens: tables.Users.notificationTokens,
        })
        .from(tables.Courses)
        .innerJoin(tables.CoursesToClasses, eq(tables.Courses.id, tables.CoursesToClasses.course))
        .innerJoin(
          tables.Students,
          and(
            eq(tables.Students.classIdentifier, tables.CoursesToClasses.classIdentifier),
            eq(tables.Students.startYear, tables.CoursesToClasses.classStartYear),
            eq(tables.Students.school, tables.Courses.school),
          ),
        )
        .innerJoin(tables.Users, eq(tables.Students.person, tables.Users.id))
        .where(and(eq(tables.Courses.isMandatory, false), eq(tables.Courses.id, uuid))),
    );

    const allStudents = new Map<string, string[]>();
    for (const student of studentsWithExplicitMembership) {
      allStudents.set(student.studentId, student.notificationTokens);
    }
    for (const student of studentsWithImplicitMembership) {
      allStudents.set(student.studentId, student.notificationTokens);
    }

    const allNotificationTokens = Array.from(allStudents.values()).flat();

    if (substitution.type === "SUBSTITUTION") {
      // todo: if substitute exists but not in kadmos, ingest canceled substitution event

      yield* ingestEffect(
        {
          type: "org.timetable.substituted",
          data: {
            course: uuid,
            start,
            originalTeacher: yield* getTeacherIdByAbbrv(substitution.originalTeacherName),
            substitute: yield* getTeacherIdByAbbrv(substitution.substituteName),
          },
        },
        SYSTEM_USER,
      ).pipe(
        Effect.tap(() => Effect.logInfo(`Timetable substituted for ${course.name}!`)),

        Effect.flatMap(() =>
          sendNotifications(
            allNotificationTokens,
            `Vertretungsplan: ${subjectNameMap[course.subject]}`,
            `${subjectNameMap[course.subject]} wird am ${format(start, "dd.MM.")} von ${substitution.substituteName} vertreten`,
          ),
        ),

        Effect.catchIf(
          (error) => error._tag === "ValidationError" && error.reason === "DUPLICATE",
          () => Effect.logDebug(`Timetable substituted event for ${course.name} already exists!`),
        ),

        Effect.catchTag("ValidationError", (error) =>
          Effect.logError(`Could not ingest timetable substituted event for ${course.name}: ${error.toString()}`),
        ),
      );
    } else {
      yield* ingestEffect(
        {
          type: "org.timetable.canceled",
          data: {
            course: uuid,
            start,
            originalTeacher: yield* getTeacherIdByAbbrv(substitution.originalTeacherName),
          },
        },
        SYSTEM_USER,
      ).pipe(
        Effect.tap(() => Effect.logInfo(`Timetable canceled event ingested for ${course.name}`)),

        Effect.flatMap(() =>
          sendNotifications(
            allNotificationTokens,
            `Vertretungsplan: ${subjectNameMap[course.subject]}`,
            `${subjectNameMap[course.subject]} fällt am ${format(start, "dd.MM.")} aus`,
          ),
        ),

        Effect.catchIf(
          (error) => error._tag === "ValidationError" && error.reason === "DUPLICATE",
          () => Effect.logDebug(`Timetable canceled event for ${course.name} already exists!`),
        ),
        Effect.catchTag("ValidationError", (error) =>
          Effect.logError(`Could not ingest timetable canceled event for ${course.name}: ${error.toString()}`),
        ),
      );
    }
  }
});
