import { SYSTEM_USER, ingest } from "@stu/api";
import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import type { SchoolId, SubjectId } from "@stu/lib";
import { Result, subjectNameMap } from "@stu/lib";

import type { ConsoleIservClient } from "./get-or-create-teacher";
import { logger } from "./logger";
import { sendNotifications } from "@stu/lib-server";
import { format } from "date-fns";

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

export const ingestTimetableEntry = async (
  {
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
  }: Entry,
  iservClient: ConsoleIservClient,
) => {
  const courseCreatedErr = await ingest(
    "org.courses.created",
    {
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
        teachers: await Promise.all(
          teacherNames.map((teacherName) =>
            iservClient.getOrCreateTeacher(teacherName),
          ),
        ),
      },
      id: crypto.randomUUID(),
      timestamp: new Date(),
    },
    SYSTEM_USER,
  );
  if (Result.isErr(courseCreatedErr)) {
    if (courseCreatedErr.error === "EXISTS") {
      logger.debug(`Course ${course.name} already created!`);
    } else {
      logger.error(
        `Could not ingest course created event for ${course.name}: ${courseCreatedErr.error}`,
      );
    }
  } else {
    logger.info(`Course ${course.name} created!`);
  }

  const existingTimetableEntry = await db.query.TimetableEntries.findFirst({
    where: and(
      eq(tables.TimetableEntries.course, uuid),
      eq(tables.TimetableEntries.start, start),
    ),
  });

  // TODO: Ensure that entries are merged before this stage --> then check for equality here
  if (
    !existingTimetableEntry ||
    existingTimetableEntry.duration < duration ||
    roomNumbers.some((room) => !existingTimetableEntry.rooms.includes(room))
  ) {
    const timetableEntryCreatedErr = await ingest(
      "org.timetable.entryCreated",
      {
        data: {
          course: uuid,
          start: start,
          duration: duration,
          rooms: roomNumbers,
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
      SYSTEM_USER,
    );
    if (Result.isErr(timetableEntryCreatedErr)) {
      logger.error(
        `Could not ingest timetable entry created event for ${course.name}: ${timetableEntryCreatedErr.error}`,
      );
      return;
    }

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
      logger.info(
        `Timetable entry created for ${course.name} on ${start.toISOString()}!`,
      );
    }
  }

  for (const substitution of substitutions) {
    const studentsWithExplicitMembership = await db
      .select({
        studentId: tables.CourseMemberships.student,
        notificationTokens: tables.Users.notificationTokens,
      })
      .from(tables.CourseMemberships)
      .innerJoin(
        tables.Users,
        eq(tables.CourseMemberships.student, tables.Users.id),
      )
      .where(eq(tables.CourseMemberships.course, uuid));

    const studentsWithImplicitMembership = await db
      .select({
        studentId: tables.Users.id,
        notificationTokens: tables.Users.notificationTokens,
      })
      .from(tables.Courses)
      .innerJoin(
        tables.CoursesToClasses,
        eq(tables.Courses.id, tables.CoursesToClasses.course),
      )
      .innerJoin(
        tables.Students,
        and(
          eq(
            tables.Students.classIdentifier,
            tables.CoursesToClasses.classIdentifier,
          ),
          eq(tables.Students.startYear, tables.CoursesToClasses.classStartYear),
          eq(tables.Students.school, tables.Courses.school),
        ),
      )
      .innerJoin(tables.Users, eq(tables.Students.person, tables.Users.id))
      .where(
        and(eq(tables.Courses.isMandatory, false), eq(tables.Courses.id, uuid)),
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

      const substitutedErr = await ingest(
        "org.timetable.substituted",
        {
          data: {
            course: uuid,
            start,
            originalTeacher: await iservClient.getOrCreateTeacher(
              substitution.originalTeacherName,
            ),
            substitute: await iservClient.getOrCreateTeacher(
              substitution.substituteName,
            ),
          },
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
        SYSTEM_USER,
      );

      if (Result.isErr(substitutedErr)) {
        if (substitutedErr.error === "EXISTS") {
          logger.debug(
            `Timetable substituted event for ${course.name} already exists!`,
          );
        } else {
          logger.error(
            `Could not ingest timetable substituted event for ${course.name}: ${substitutedErr.error}`,
          );
        }
      } else {
        logger.info(`Timetable substituted for ${course.name}!`);

        await sendNotifications(
          allNotificationTokens,
          `Vertretungsplan: ${subjectNameMap[course.subject]}`,
          `${subjectNameMap[course.subject]} wird am ${format(start, "dd.MM.")} von ${substitution.substituteName} vertreten`,
        );
      }
    } else {
      const canceledErr = await ingest(
        "org.timetable.canceled",
        {
          data: {
            course: uuid,
            start,
            originalTeacher: await iservClient.getOrCreateTeacher(
              substitution.originalTeacherName,
            ),
          },
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
        SYSTEM_USER,
      );

      if (Result.isErr(canceledErr)) {
        if (canceledErr.error === "EXISTS") {
          logger.debug(
            `Timetable canceled event for ${course.name} already exists!`,
          );
        } else {
          logger.error(
            `Could not ingest timetable canceled event for ${course.name}: ${canceledErr.error}`,
          );
        }
      } else {
        logger.info(`Timetable canceled for ${course.name}!`);

        await sendNotifications(
          allNotificationTokens,
          `Vertretungsplan: ${subjectNameMap[course.subject]}`,
          `${subjectNameMap[course.subject]} fällt am ${format(start, "dd.MM.")} aus`,
        );
      }
    }
  }
};
