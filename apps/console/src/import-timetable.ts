import crypto from "crypto";
import { add, endOfWeek, format, startOfWeek } from "date-fns";

import type { KadmosTimetableResponse } from "@stu/external-api";
import type { SchoolId, SubjectId } from "@stu/lib";
import { and, between, eq, gte, lte } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools, Semesters, TimetableEntries } from "@stu/db/schema";
import { getClasses, getTimetable, login } from "@stu/external-api";
import {
  BetterMap,
  guessSubject,
  isArrayNonEmpty,
  isArraySingleElement,
} from "@stu/lib";

import { ConsoleIservClient } from "./get-or-create-teacher";
import { ingestTimetableEntry } from "./ingest-timetable-entry";
import { mapKadmosClass } from "./map-kadmos-class";

interface Options {
  school: SchoolId;
  date: Date;
}

interface ProtoTimetableEntry {
  course: {
    kadmosId: number;
    name: string;
    longName: string;
    subject: SubjectId;
  };
  classes: {
    identifierInYear: string;
    startYear: number;
  }[];
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
  teacherNames: string[];
  roomNumbers: string[];
  start: Date;
  duration: number;
}

/**
 * A course is uniquely identified by the combination of:
 * - The school
 * - The kadmos id (in the case of IGS Lilienthal, this is unique per subject)
 * - The class(es) it is taught in
 */
const generateCourseUuid = (
  school: SchoolId,
  entry: Pick<ProtoTimetableEntry, "course" | "classes">,
) => {
  return crypto
    .createHash("sha256")
    .update(school)
    .update(entry.course.kadmosId.toString())
    .update(
      entry.classes
        .map((cls) => `${cls.startYear}.${cls.identifierInYear}`)
        .join(","),
    )
    .digest("hex")
    .slice(0, 32);
};

const findSemesterFromDate = async (date: Date, school: SchoolId) => {
  const semesters = await db.query.Semesters.findMany({
    where: and(
      eq(Semesters.school, school),
      lte(Semesters.start, date),
      gte(Semesters.end, date),
    ),
  });

  if (!isArraySingleElement(semesters)) {
    throw new Error(`Invalid number of semesters found: ${semesters.length}`);
  }

  return semesters[0];
};

const checkOverlap = (a: ProtoTimetableEntry, b: ProtoTimetableEntry) => {
  if (a.course.kadmosId !== b.course.kadmosId) return false;

  const aStart = a.start.getTime();
  const aEnd = add(a.start, { minutes: a.duration }).getTime();
  const bStart = b.start.getTime();
  const bEnd = add(b.start, { minutes: b.duration }).getTime();

  const doTimesTouch = aStart <= bEnd && bStart <= aEnd;

  if (!doTimesTouch) return false;

  const areTeachersEqual =
    a.teacherNames.length === b.teacherNames.length &&
    a.teacherNames.every((name) => b.teacherNames.includes(name));

  const areRoomsEqual =
    a.roomNumbers.length === b.roomNumbers.length &&
    a.roomNumbers.every((room) => b.roomNumbers.includes(room));

  const areClassesEqual =
    a.classes.length === b.classes.length &&
    a.classes.every((cls) =>
      b.classes.some(
        (otherCls) =>
          cls.identifierInYear === otherCls.identifierInYear &&
          cls.startYear === otherCls.startYear,
      ),
    );

  if (areTeachersEqual && areRoomsEqual && areClassesEqual) {
    return true;
  }

  const doTimesOverlap =
    (aStart < bEnd && bStart < aEnd) || aStart === bStart || aEnd === bEnd;

  if (doTimesOverlap && areTeachersEqual) {
    return true;
  }

  return false;
};

const collectEntries = (timetable: KadmosTimetableResponse) => {
  const { elementPeriods, elements } = timetable;

  const classes = BetterMap.uniqueFromValues(
    elements.filter((element) => element.type === 1),
    "id",
  );
  const teachers = BetterMap.uniqueFromValues(
    elements.filter((element) => element.type === 2),
    "id",
  );
  const courses = BetterMap.uniqueFromValues(
    elements.filter((element) => element.type === 3),
    "id",
  );
  const rooms = BetterMap.uniqueFromValues(
    elements.filter((element) => element.type === 4),
    "id",
  );

  const entriesToInsert: ProtoTimetableEntry[] = [];

  for (const period of Object.values(elementPeriods).flat()) {
    const periodClasses = period.elements
      .filter((el) => el.type === 1)
      .map((el) => classes.get(el.orgId || el.id))
      .filter((cls) => !!cls);
    const periodTeachers = period.elements
      .filter((el) => el.type === 2)
      .map((el) => ({
        state: el.state,
        substitute: el.orgId > 0 ? teachers.get(el.id) : undefined,
        teacher: teachers.get(el.orgId || el.id),
      }))
      .map((el) => ({
        state: el.state,
        substitute: el.substitute?.name === "---" ? undefined : el.substitute,
        teacher: el.teacher?.name === "---" ? undefined : el.teacher,
      }));

    const periodCourses = period.elements
      .filter((el) => el.type === 3)
      .map((el) => courses.get(el.orgId || el.id))
      .filter((course) => !!course);
    const periodRooms = period.elements
      .filter((el) => el.type === 4)
      .map((el) => rooms.get(el.orgId || el.id))
      .filter((room) => !!room)
      .filter((room) => room.name !== "---");

    if (periodClasses.length === 0) {
      throw new Error(
        `Expected at least one class in period: ${JSON.stringify(period)} ${JSON.stringify(
          periodCourses.map((el) => el.name + " " + el.longName),
        )}`,
      );
    }

    if (periodTeachers.length === 0) {
      // console.warn(
      //   `No teachers found for period with classes ${periodClasses
      //     .map((el) => `${el.name} ${el.longName}`)
      //     .join(", ")} on date ${format(period.date, "yyyy-MM-dd")}`,
      // );
      continue;
    }

    if (!isArraySingleElement(periodCourses)) {
      // console.warn(
      //   `Expected exactly one course in period with classes ${periodClasses
      //     .map((el) => `${el.name} ${el.longName}`)
      //     .join(
      //       ", ",
      //     )} on date ${format(period.date, "yyyy-MM-dd")}. Found ${periodCourses.length} courses.`,
      // );
      continue;
    }

    const [course] = periodCourses;

    const subject = guessSubject(course.name);

    if (!subject) {
      console.warn(`Unknown subject: "${course.name}". Skipping this course.`);
      continue;
    }

    // TODO: re-enable this
    // if (periodRooms.length > 0) {
    //   await db
    //     .insert(Rooms)
    //     .values(
    //       periodRooms.map((room) => ({
    //         roomNumber: room.name,
    //         name: room.longName,
    //       })),
    //     )
    //     .onConflictDoNothing();
    // }

    // Some sanity checks
    // if (period.cellState === "SUBSTITUTION") {
    //   if (period.elements.every((element) => element.state !== "SUBSTITUTED")) {
    //     console.warn(
    //       `Substitution without substituted elements found for period with classes ${periodClasses
    //         .map((el) => `${el.name} ${el.longName}`)
    //         .join(
    //           ", ",
    //         )} on date ${format(period.date, "yyyy-MM-dd")}. ${period.elements
    //         .filter((element) => element.state !== "SUBSTITUTED")
    //         .map((element) => `${element.type} ${element.state}`)
    //         .join(", ")}`,
    //     );
    //   }
    //   if (
    //     period.elements.some(
    //       (element) =>
    //         element.type !== 2 &&
    //         element.type !== 4 &&
    //         element.state !== "REGULAR",
    //     )
    //   ) {
    //     console.warn(
    //       `Substitution with non-regular elements found for period with classes ${periodClasses
    //         .map((el) => `${el.name} ${el.longName}`)
    //         .join(
    //           ", ",
    //         )} on date ${format(period.date, "yyyy-MM-dd")}. ${period.elements
    //         .filter(
    //           (element) => element.type !== 2 && element.state !== "REGULAR",
    //         )
    //         .map((element) => `${element.type} ${element.state}`)
    //         .join(", ")}`,
    //     );
    //   }
    // }

    const entryTeachers: string[] = [];
    const substitutions: ProtoTimetableEntry["substitutions"] = [];
    for (const teacher of periodTeachers) {
      if (teacher.state === "SUBSTITUTED") {
        if (!teacher.substitute) {
          throw new Error("Substitute is missing");
        }

        if (!teacher.teacher) {
          throw new Error("Teacher is missing");
        }

        substitutions.push({
          type: "SUBSTITUTION",
          originalTeacherName: teacher.teacher.name,
          substituteName: teacher.substitute.name,
        });
        continue;
      }

      if (teacher.state === "ABSENT") {
        if (teacher.substitute) {
          throw new Error(
            `Absent should have no substitute. Classes: ${JSON.stringify(periodClasses.map(mapKadmosClass))}\nDate: ${format(period.date, "yyyy-MM-dd")}`,
          );
        }

        if (!teacher.teacher) {
          throw new Error("Teacher is missing");
        }

        substitutions.push({
          type: "ABSENT",
          originalTeacherName: teacher.teacher.name,
        });
        continue;
      }

      // Regular
      if (teacher.substitute) {
        throw new Error("Regular should have no substitute");
      }

      if (!teacher.teacher) {
        throw new Error("Teacher is missing");
      }

      entryTeachers.push(teacher.teacher.name);
    }

    entriesToInsert.push({
      course: {
        kadmosId: course.id,
        longName: course.longName,
        name: course.name,
        subject,
      },
      classes: periodClasses.map(mapKadmosClass),
      duration: period.endTime - period.startTime,
      start: add(period.date, { minutes: period.startTime }),
      roomNumbers: periodRooms.map((room) => room.name),
      teacherNames: entryTeachers,
      substitutions,
    });
  }

  return entriesToInsert;
};

export const importTimetable = async ({ school, date }: Options) => {
  const schoolEntity = await db.query.Schools.findFirst({
    where: eq(Schools.id, school),
  });
  if (!schoolEntity) throw new Error(`School ${school} not found`);

  const { kadmosName, kadmosUsername, kadmosPassword } = schoolEntity;

  const jar = await login(kadmosName, kadmosUsername, kadmosPassword);
  const kadmosClasses = await getClasses(jar).then((classes) =>
    classes.map(mapKadmosClass),
  );

  const iservClient = new ConsoleIservClient();

  // First, we collect all entries for the week over all classes
  const entriesToInsert: ProtoTimetableEntry[] = [];
  for (const cls of kadmosClasses) {
    const timetable = await getTimetable(cls.id, date, jar);
    const entries = collectEntries(timetable);
    entriesToInsert.push(...entries);
  }

  // Then, we merge adjacent entries into one timetable entry.
  // e.g. if two identical entries are back-to-back, we merge them into one.
  // also, two entries with the same teacher at the same time are merged since it is impossible for a teacher to teach two classes at the same time.
  const joinedEntries: ProtoTimetableEntry[] = [];
  for (const entry of entriesToInsert) {
    const adjacentEntries = entriesToInsert.filter((otherEntry) =>
      checkOverlap(entry, otherEntry),
    );

    if (!isArrayNonEmpty(adjacentEntries)) {
      throw new Error(
        "LogicError: Expected at least one adjacent entry for " +
          JSON.stringify(entry),
      );
    }

    const joinedRooms: string[] = [];
    for (const entry of adjacentEntries) {
      for (const room of entry.roomNumbers) {
        if (!joinedRooms.includes(room)) {
          joinedRooms.push(room);
        }
      }
    }

    const joinedTeachers: string[] = [];
    for (const entry of adjacentEntries) {
      for (const teacher of entry.teacherNames) {
        if (!joinedTeachers.includes(teacher)) {
          joinedTeachers.push(teacher);
        }
      }
    }

    const joinedClasses: ProtoTimetableEntry["classes"] = [];
    for (const entry of adjacentEntries) {
      for (const cls of entry.classes) {
        if (
          !joinedClasses.some(
            (otherCls) =>
              otherCls.identifierInYear === cls.identifierInYear &&
              otherCls.startYear === cls.startYear,
          )
        ) {
          joinedClasses.push(cls);
        }
      }
    }

    const joinedSubstitutions: ProtoTimetableEntry["substitutions"] = [];
    for (const entry of adjacentEntries) {
      for (const substitution of entry.substitutions) {
        if (
          !joinedSubstitutions.some(
            (otherSubstitution) =>
              otherSubstitution.type === substitution.type &&
              (substitution.type === "SUBSTITUTION"
                ? otherSubstitution.substituteName ===
                  substitution.substituteName
                : true),
          )
        ) {
          joinedSubstitutions.push(substitution);
        }
      }
    }

    const joinedStart = Math.min(
      ...adjacentEntries.map((entry) => entry.start.getTime()),
    );
    const joinedEnd = Math.max(
      ...adjacentEntries.map((entry) =>
        add(entry.start, { minutes: entry.duration }).getTime(),
      ),
    );
    const joinedDuration = (joinedEnd - joinedStart) / 1000 / 60;

    joinedEntries.push({
      course: entry.course,
      classes: joinedClasses,
      roomNumbers: joinedRooms,
      teacherNames: joinedTeachers,
      start: new Date(joinedStart),
      duration: joinedDuration,
      substitutions: joinedSubstitutions,
    });
  }

  // Finally, we find all distinct courses.
  // In this step, we join two courses if they have the same name and have at least one class in common.
  const courses = new BetterMap<
    string, // the uuid
    {
      course: ProtoTimetableEntry["course"];
      classes: ProtoTimetableEntry["classes"];
      entries: Omit<ProtoTimetableEntry, "course" | "classes">[];
    }
  >();
  outer: for (const entry of joinedEntries) {
    const uuid = generateCourseUuid(school, entry);
    const existingCourse = courses.get(uuid);
    if (existingCourse) {
      existingCourse.entries.push(entry);
      continue;
    }

    for (const [uuid, course] of [...courses.entries()]) {
      // We need to copy the entries because we will modify the map
      if (
        course.course.name === entry.course.name &&
        entry.classes.some((cls) =>
          course.classes.some(
            (otherCls) =>
              otherCls.identifierInYear === cls.identifierInYear &&
              otherCls.startYear === cls.startYear,
          ),
        )
      ) {
        const joinedClasses: ProtoTimetableEntry["classes"] = [];
        for (const cls of entry.classes) {
          if (
            !joinedClasses.some(
              (otherCls) =>
                otherCls.identifierInYear === cls.identifierInYear &&
                otherCls.startYear === cls.startYear,
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

  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });

  // Insert all courses into the database
  for (const [uuid, course] of courses.entries()) {
    const existingTimetableEntries = await db.query.TimetableEntries.findMany({
      where: and(
        eq(TimetableEntries.course, uuid),
        between(TimetableEntries.start, start, end),
      ),
    });

    // Check if any existing timetable entries are not in the current kadmos timetable
    for (const existingTimetableEntry of existingTimetableEntries) {
      const existingEntry = course.entries.find(
        (entry) =>
          entry.start.getTime() === existingTimetableEntry.start.getTime(),
      );
      if (!existingEntry) {
        throw new Error(
          `Timetable entry ${existingTimetableEntry.start} is not present in the current timetable. Need to implement this event!`,
        );
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
          substitutions: entry.substitutions,
          teacherNames: entry.teacherNames,
          roomNumbers: entry.roomNumbers,

          classes: course.classes,
          course: course.course,
        },
        iservClient,
      );
    }
  }
};
