import crypto from "node:crypto";
import { ingest, SYSTEM_USER } from "@stu/api";
import { and, between, eq, gte, lte } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { Semesters } from "@stu/db/schema";
import { type AuthContext, getClassesV2, getTimetableV2 } from "@stu/external-api";
import type { SchoolId, SimpleDate } from "@stu/lib";
import { BetterMap, isArraySingleElement } from "@stu/lib";
import { endOfWeek, startOfWeek } from "date-fns";
import { Exit } from "effect";
import { z } from "zod";
import { ConsoleIservClient } from "./get-or-create-teacher";
import { ingestTimetableEntry } from "./ingest-timetable-entry";
import { logger } from "./logger";
import type { ProtoTimetableEntry } from "./map-kadmos-class";
import { mapKadmosClassV2, mapKadmosTimetableEntry } from "./map-kadmos-class";

interface Options {
  school: SchoolId;
  date: Date;
  monthOffsetRange: [number, number];
  dryRun: boolean;
  schoolYearId: number;
}

/**
 * A course is uniquely identified by the combination of:
 * - The school
 * - The kadmos id (in the case of IGS Lilienthal, this is unique per subject)
 * - The class(es) it is taught in
 */
const generateCourseUuid = (school: SchoolId, entry: Pick<ProtoTimetableEntry, "course" | "classes">) => {
  const uuid = crypto
    .createHash("sha256")
    .update(school)
    .update(entry.course.name)
    .update(entry.classes.map((cls) => `${cls.startYear}.${cls.identifierInYear}`).join(","))
    .digest("hex")
    .slice(0, 32);

  const formattedUuid = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
  return z.string().uuid().parse(formattedUuid);
};

const findSemesterFromDate = async (date: Date, school: SchoolId) => {
  const semesters = await db.query.Semesters.findMany({
    where: and(eq(Semesters.school, school), lte(Semesters.start, date), gte(Semesters.end, date)),
  });

  if (!isArraySingleElement(semesters)) {
    throw new Error(`Invalid number of semesters found: ${semesters.length}`);
  }

  return semesters[0];
};

const getTimetable = async (options: Options, authContext: AuthContext) => {
  
}

export const importTimetable = async (
  options: Options,
  authContext: AuthContext,
) => {
  const startDate = startOfWeek(date, { weekStartsOn: 1 });
  const endDate = endOfWeek(date, { weekStartsOn: 1 });
  const start = {
    year: startDate.getFullYear(),
    month: startDate.getMonth() + 1 + offsetStart,
    day: startDate.getDate(),
  };
  const end = {
    year: endDate.getFullYear(),
    month: endDate.getMonth() + 1 + offsetEnd,
    day: endDate.getDate(),
  };

  logger.info(
    `Downloading timetable for ${start.year}-${start.month}-${start.day} to ${end.year}-${end.month}-${end.day}...`,
  );

  const kadmosClasses = await getClassesV2(start, end, schoolYearId, authContext).then((classes) =>
    classes.classes.map(mapKadmosClassV2),
  );

  const iservClient = new ConsoleIservClient();

  // First, we collect all entries for the week over all classes
  const entriesToInsert: ProtoTimetableEntry[] = [];
  for (const cls of kadmosClasses) {
    const timetable = await getTimetableV2(start, end, cls.kadmosId, authContext);

    entriesToInsert.push(
      ...timetable.days
        .flatMap((day) => day.gridEntries.map((entry) => mapKadmosTimetableEntry(entry, cls)))
        .filter((x) => x !== null),
    );
  }

  // Finally, we find all distinct courses.
  // In this step, we join two courses if they have the same name and the same teachers.
  const courses = new BetterMap<
    string, // the uuid
    {
      course: ProtoTimetableEntry["course"];
      classes: ProtoTimetableEntry["classes"];
      entries: Omit<ProtoTimetableEntry, "course" | "classes">[];
    }
  >();
  outer: for (const entry of entriesToInsert) {
    const uuid = generateCourseUuid(school, entry);
    const existingCourse = courses.get(uuid);
    if (existingCourse) {
      existingCourse.entries.push(entry);
      continue;
    }

    for (const [uuid, course] of [...courses.entries()]) {
      const matchesTeacherAndTime = (entry: ProtoTimetableEntry) => {
        const entryAtSameTime = course.entries.find(
          (otherEntry) =>
            otherEntry.start.getTime() === entry.start.getTime() && otherEntry.duration === entry.duration,
        );
        if (!entryAtSameTime) return false;
        return entryAtSameTime.teachers.every((teacher) =>
          entry.teachers.some((otherTeacher) => otherTeacher.abbrv === teacher.abbrv),
        );
      };

      if (course.course.name === entry.course.name && matchesTeacherAndTime(entry)) {
        // We need to copy the entries because we will modify the map
        const joinedClasses: ProtoTimetableEntry["classes"] = [];
        for (const cls of entry.classes) {
          if (
            !joinedClasses.some(
              (otherCls) => otherCls.identifierInYear === cls.identifierInYear && otherCls.startYear === cls.startYear,
            )
          ) {
            joinedClasses.push(cls);
          }
        }

        const newUuid = generateCourseUuid(school, {
          course: entry.course,
          classes: joinedClasses,
        });

        courses.delete(uuid);
        courses.set(newUuid, {
          course: entry.course,
          classes: joinedClasses,
          entries: [...course.entries, entry],
        });

        continue outer;
      }
    }

    // If we reach this point, we have a new course
    courses.set(uuid, {
      course: entry.course,
      classes: entry.classes,
      entries: [entry],
    });
  }

  // // Insert all courses into the database
  for (const [uuid, course] of courses.entries()) {
    // We need to make sure all course.classes are unique. They might be duplicated because of kadmos weirdness.
    // TODO: Handle classes.change === "REMOVED"
    course.classes = course.classes.filter(
      (cls, index, self) =>
        index ===
        self.findIndex(
          (otherCls) => otherCls.identifierInYear === cls.identifierInYear && otherCls.startYear === cls.startYear,
        ),
    );

    const existingTimetableEntries = await db.query.TimetableEntries.findMany({
      where: and(
        eq(tables.TimetableEntries.course, uuid),
        between(
          tables.TimetableEntries.start,
          new Date(start.year, start.month - 1, start.day),
          new Date(end.year, end.month - 1, end.day),
        ),
      ),
    });

    // Check if any existing timetable entries are not in the current kadmos timetable
    for (const existingTimetableEntry of existingTimetableEntries) {
      const existingEntry = course.entries.find(
        (entry) => entry.start.getTime() === existingTimetableEntry.start.getTime(),
      );
      if (!existingEntry) {
        const res = await ingest(
          {
            type: "org.timetable.discarded",
            data: {
              course: uuid,
              start: existingTimetableEntry.start,
            },
            id: crypto.randomUUID(),
            timestamp: new Date(),
          },
          SYSTEM_USER,
        );

        if (Exit.isFailure(res)) {
          if (res.cause._tag === "Fail" && res.cause.error.reason === "NOT_FOUND") {
            logger.error(
              `Timetable entry does not exist. Could not discard: ${JSON.stringify(existingTimetableEntry)}`,
            );
          } else {
            logger.error(`Could not ingest timetable discarded event for ${uuid}: ${res.cause.toString()}`);
          }
        } else {
          logger.info(`Timetable entry discarded: ${JSON.stringify(existingTimetableEntry)}`);
        }
      }
    }

    for (const entry of course.entries) {
      const semester = await findSemesterFromDate(entry.start, school);

      await ingestTimetableEntry(
        {
          uuid,
          school,
          semester,

          start: entry.start,
          duration: entry.duration,
          substitutions: entry.teachers
            .map((teacher) =>
              teacher.change === null
                ? null
                : teacher.change.type === "REPLACED"
                  ? {
                      type: "SUBSTITUTION" as const,
                      originalTeacherName: teacher.abbrv,
                      substituteName: teacher.change.abbrv,
                    }
                  : {
                      type: "ABSENT" as const,
                      originalTeacherName: teacher.abbrv,
                    },
            )
            .filter((x) => x !== null),
          teacherNames: entry.teachers.map((teacher) => teacher.abbrv),
          roomNumbers: entry.roomNumbers
            .map((room) =>
              room.change === null ? room.name : room.change.type === "REPLACED" ? room.change.name : null,
            )
            .filter((x) => x !== null),

          classes: course.classes,
          course: course.course,
        },
        iservClient,
      );
    }
  }
};
