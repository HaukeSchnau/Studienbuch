import type { SchoolId, SubjectId } from "@stu/lib";
import { ingest, SYSTEM_USER } from "@stu/api";
import { and, eq } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";

import type { ConsoleIservClient } from "./get-or-create-teacher";
import { logger } from "./logger";

interface Entry {
  uuid: string;
  course: {
    name: string;
    longName: string;
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
        longName: course.longName,
        subject: course.subject,
        isMandatory: false,
        school,
        semesterType: semester.type,
        semesterYear: semester.year,
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
  if (courseCreatedErr === "EXISTS") {
    logger.debug(`Course ${course.name} already created!`);
  } else if (courseCreatedErr) {
    logger.error(
      `Could not ingest course created event for ${course.name}: ${courseCreatedErr}`,
    );
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
    if (timetableEntryCreatedErr) {
      logger.error(
        `Could not ingest timetable entry created event for ${course.name}: ${timetableEntryCreatedErr}`,
      );
      return;
    } else {
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
        logger.info(`Timetable entry created for ${course.name}!`);
      }
    }
  }

  for (const substitution of substitutions) {
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

      if (substitutedErr === "EXISTS") {
        logger.debug(
          `Timetable substituted event for ${course.name} already exists!`,
        );
      } else if (substitutedErr) {
        logger.error(
          `Could not ingest timetable substituted event for ${course.name}: ${substitutedErr}`,
        );
      } else {
        logger.info(`Timetable substituted for ${course.name}!`);
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

      if (canceledErr === "EXISTS") {
        logger.debug(
          `Timetable canceled event for ${course.name} already exists!`,
        );
      } else if (canceledErr) {
        logger.error(
          `Could not ingest timetable canceled event for ${course.name}: ${canceledErr}`,
        );
      } else {
        logger.info(`Timetable canceled for ${course.name}!`);
      }
    }
  }
};
