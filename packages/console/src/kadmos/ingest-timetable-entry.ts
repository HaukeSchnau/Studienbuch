import { ingest, SYSTEM_USER } from "@stu/api";
import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import type { SchoolId, SubjectId } from "@stu/lib";
import { subjectNameMap } from "@stu/lib";
import { sendNotifications } from "@stu/lib-server";
import { format } from "date-fns";
import { Exit } from "effect";
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

const getTeacherId = async (abbrv: string) => {
  const id = await db.query.Persons.findFirst({
    where: eq(tables.Persons.abbrv, abbrv),
  }).then((person) => person?.id);
  if (!id) throw new Error(`Teacher ${abbrv} not found`);
  return id;
};

export const ingestTimetableEntry = async ({
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
}: Entry) => {
  const courseCreatedErr = await ingest(
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
        teachers: await Promise.all(teacherNames.map(getTeacherId)),
      },
      id: crypto.randomUUID(),
      timestamp: new Date(),
    },
    SYSTEM_USER,
  );
  if (Exit.isFailure(courseCreatedErr)) {
    if (courseCreatedErr.cause._tag === "Fail" && courseCreatedErr.cause.error.reason === "DUPLICATE") {
      logger.debug(`Course ${course.name} already created!`);
    } else {
      logger.error(`Could not ingest course created event for ${course.name}: ${courseCreatedErr.cause.toString()}`);
    }
  } else {
    logger.info(`Course ${course.name} created!`);
  }

  const existingTimetableEntry = await db.query.TimetableEntries.findFirst({
    where: and(eq(tables.TimetableEntries.course, uuid), eq(tables.TimetableEntries.start, start)),
  });

  // TODO: Ensure that entries are merged before this stage --> then check for equality here
  if (
    !existingTimetableEntry ||
    existingTimetableEntry.duration < duration ||
    roomNumbers.some((room) => !existingTimetableEntry.rooms.includes(room))
  ) {
    const timetableEntryCreatedErr = await ingest(
      {
        type: "org.timetable.entryCreated",
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
    if (Exit.isFailure(timetableEntryCreatedErr)) {
      logger.error(
        `Could not ingest timetable entry created event for ${course.name}: ${timetableEntryCreatedErr.cause.toString()}`,
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
      logger.info(`Timetable entry created for ${course.name} on ${start.toISOString()}!`);
    }
  }

  for (const substitution of substitutions) {
    const studentsWithExplicitMembership = await db
      .select({
        studentId: tables.CourseMemberships.student,
        notificationTokens: tables.Users.notificationTokens,
      })
      .from(tables.CourseMemberships)
      .innerJoin(tables.Users, eq(tables.CourseMemberships.student, tables.Users.id))
      .where(eq(tables.CourseMemberships.course, uuid));

    const studentsWithImplicitMembership = await db
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
      .where(and(eq(tables.Courses.isMandatory, false), eq(tables.Courses.id, uuid)));

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
        {
          type: "org.timetable.substituted",
          data: {
            course: uuid,
            start,
            originalTeacher: await getTeacherId(substitution.originalTeacherName),
            substitute: await getTeacherId(substitution.substituteName),
          },
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
        SYSTEM_USER,
      );

      if (Exit.isFailure(substitutedErr)) {
        if (substitutedErr.cause._tag === "Fail" && substitutedErr.cause.error.reason === "DUPLICATE") {
          logger.debug(`Timetable substituted event for ${course.name} already exists!`);
        } else {
          logger.error(
            `Could not ingest timetable substituted event for ${course.name}: ${substitutedErr.cause.toString()}`,
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
        {
          type: "org.timetable.canceled",
          data: {
            course: uuid,
            start,
            originalTeacher: await getTeacherId(substitution.originalTeacherName),
          },
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
        SYSTEM_USER,
      );

      if (Exit.isFailure(canceledErr)) {
        if (canceledErr.cause._tag === "Fail" && canceledErr.cause.error.reason === "DUPLICATE") {
          logger.debug(`Timetable canceled event for ${course.name} already exists!`);
        } else {
          logger.error(`Could not ingest timetable canceled event for ${course.name}: ${canceledErr.cause.toString()}`);
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
