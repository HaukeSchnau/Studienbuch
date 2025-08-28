import crypto from "node:crypto";
import { ingestEffect, SYSTEM_USER } from "@stu/api";
import { and, between, Database, eq } from "@stu/db";
import * as tables from "@stu/db/schema";
import { UntisClasses, UntisTimetable } from "@stu/external-api";
import type { SchoolId, SimpleDate } from "@stu/lib";
import { BetterMap, ensureEntityDefined, SemesterRepository } from "@stu/lib";
import { Effect } from "effect";
import { z } from "zod";
import type { ProtoTimetableEntry } from "../map-kadmos-class";
import { mapKadmosClassV2, mapKadmosTimetableEntry } from "../map-kadmos-class";
import { ingestTimetableEntry } from "./ingest-timetable-entry";

interface Options {
  school: SchoolId;
  start: SimpleDate;
  end: SimpleDate;
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

const getTimetable = Effect.fn(function* (options: Options) {
  const { start, end, school } = options;
  yield* Effect.logInfo(
    `Downloading timetable for ${start.year}-${start.month}-${start.day} to ${end.year}-${end.month}-${end.day}...`,
  );

  const untisClasses = yield* UntisClasses.list(options).pipe(
    Effect.map((classes) => classes.classes.map(mapKadmosClassV2)),
  );

  // First, we collect all entries for the week over all classes
  const entriesToInsert: ProtoTimetableEntry[] = [];
  for (const cls of untisClasses) {
    const timetable = yield* UntisTimetable.get({
      ...options,
      kadmosClassId: cls.kadmosId,
    });

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
        const joinedClasses: ProtoTimetableEntry["classes"] = [...course.classes];
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

  return {
    courses: courses.entries(),
    start,
    end,
  };
});

export const importTimetable = Effect.fn(function* (options: Options) {
  const { courses, start, end } = yield* getTimetable(options);
  const { school } = options;
  const db = yield* Database;

  // Insert all courses into the database
  for (const [uuid, course] of courses) {
    // We need to make sure all course.classes are unique. They might be duplicated because of kadmos weirdness.
    // TODO: Handle classes.change === "REMOVED"
    course.classes = course.classes.filter(
      (cls, index, self) =>
        index ===
        self.findIndex(
          (otherCls) => otherCls.identifierInYear === cls.identifierInYear && otherCls.startYear === cls.startYear,
        ),
    );

    const existingTimetableEntries = yield* db.execute((db) =>
      db.query.TimetableEntries.findMany({
        where: and(
          eq(tables.TimetableEntries.course, uuid),
          between(
            tables.TimetableEntries.start,
            new Date(start.year, start.month - 1, start.day),
            new Date(end.year, end.month - 1, end.day),
          ),
        ),
      }),
    );

    // Check if any existing timetable entries are not in the current kadmos timetable
    for (const existingTimetableEntry of existingTimetableEntries) {
      const existingEntry = course.entries.find(
        (entry) => entry.start.getTime() === existingTimetableEntry.start.getTime(),
      );
      if (!existingEntry) {
        yield* ingestEffect(
          {
            type: "org.timetable.discarded",
            data: {
              course: uuid,
              start: existingTimetableEntry.start,
            },
          },
          SYSTEM_USER,
        ).pipe(
          Effect.tap(() => Effect.logInfo(`Timetable entry discarded: ${JSON.stringify(existingTimetableEntry)}`)),
          Effect.catchIf(
            (error) => error.reason === "NOT_FOUND",
            () =>
              Effect.logError(
                `Timetable entry does not exist. Could not discard: ${JSON.stringify(existingTimetableEntry)}`,
              ),
          ),
          Effect.catchAll((err) =>
            Effect.logError(`Could not ingest timetable discarded event for ${uuid}: ${err.toString()}`),
          ),
        );
      }
    }

    const semesterRepository = yield* SemesterRepository;
    for (const entry of course.entries) {
      const semester = yield* semesterRepository
        .getSemesterOnDate(entry.start, school)
        .pipe(Effect.flatMap(ensureEntityDefined("semester on date", { start: entry.start, school })));

      yield* ingestTimetableEntry({
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
          .map((room) => (room.change === null ? room.name : room.change.type === "REPLACED" ? room.change.name : null))
          .filter((x) => x !== null),

        classes: course.classes,
        course: course.course,
      });
    }
  }
});
