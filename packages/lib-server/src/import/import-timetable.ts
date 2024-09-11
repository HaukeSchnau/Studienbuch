import crypto from "crypto";
import { add, endOfWeek, startOfWeek } from "date-fns";

import type { KadmosTimetableResponse } from "@stu/external-api";
import type { SchoolId, SubjectId } from "@stu/lib";
import { and, between, eq, gte, lte } from "@stu/db";
import { db } from "@stu/db/client";
import {
  Courses,
  Rooms,
  Schools,
  SemesterCourses,
  SemesterCoursesToClasses,
  SemesterCoursesToTeachers,
  Semesters,
  TimetableEntries,
  TimetableEntryRooms,
} from "@stu/db/schema";
import { getClasses, getTimetable, login } from "@stu/external-api";
import {
  BetterMap,
  guessSubject,
  isArrayNonEmpty,
  isArraySingleElement,
} from "@stu/lib";

import { createLazyIservClient } from "../lazy-iserv-client";
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
  teacherNames: string[];
  roomNumbers: string[];
  start: Date;
  duration: number;
}

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

const collectEntries = async (timetable: KadmosTimetableResponse) => {
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
      .map((el) => classes.get(el.id))
      .filter((cls) => !!cls);
    const periodTeachers = period.elements
      .filter((el) => el.type === 2)
      .map((el) => teachers.get(el.id))
      .filter((teacher) => !!teacher);
    const periodCourses = period.elements
      .filter((el) => el.type === 3)
      .map((el) => courses.get(el.id))
      .filter((course) => !!course);
    const periodRooms = period.elements
      .filter((el) => el.type === 4)
      .map((el) => rooms.get(el.id))
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

    if (periodRooms.length > 0) {
      await db
        .insert(Rooms)
        .values(
          periodRooms.map((room) => ({
            roomNumber: room.name,
            name: room.longName,
          })),
        )
        .onConflictDoNothing();
    }

    // if (period.cellState === "SUBSTITUTION") {
    // if (
    //   period.elements.every((element) => element.state !== "SUBSTITUTED")
    // ) {
    //   console.warn(
    //     `Substitution without substituted elements found for period with classes ${periodClasses
    //       .map((el) => `${el.name} ${el.longName}`)
    //       .join(
    //         ", ",
    //       )} on date ${format(period.date, "yyyy-MM-dd")}. ${period.elements
    //       .filter((element) => element.state !== "SUBSTITUTED")
    //       .map((element) => `${element.type} ${element.state}`)}`,
    //   );
    // }
    // if (
    //   period.elements.some(
    //     (element) =>
    //       element.type !== 2 &&
    //       element.type !== 4 &&
    //       element.state !== "REGULAR",
    //   )
    // ) {
    //   console.warn(
    //     `Substitution with non-regular elements found for period with classes ${periodClasses
    //       .map((el) => `${el.name} ${el.longName}`)
    //       .join(
    //         ", ",
    //       )} on date ${format(period.date, "yyyy-MM-dd")}. ${period.elements
    //       .filter(
    //         (element) => element.type !== 2 && element.state !== "REGULAR",
    //       )
    //       .map((element) => `${element.type} ${element.state}`)}`,
    //   );
    // }
    // }

    entriesToInsert.push({
      course: {
        kadmosId: course.id,
        longName: course.longName,
        name: course.name,
        subject,
      },
      classes: periodClasses.map(mapKadmosClass),
      duration: period.endTime - period.startTime,
      start: add(period.date, { minutes: period.startTime, hours: 2 }), // TODO: Timezone
      roomNumbers: periodRooms.map((room) => room.name),
      teacherNames: periodTeachers
        .map((teacher) => teacher.name)
        .filter((name) => name !== "---"),
    });
  }

  return entriesToInsert;
};

export const importTimetable = async ({ school, date }: Options) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  await db
    .delete(TimetableEntries)
    .where(
      and(
        eq(TimetableEntries.school, school),
        between(TimetableEntries.start, start, end),
      ),
    );

  const schoolEntity = await db.query.Schools.findFirst({
    where: eq(Schools.id, school),
  });
  if (!schoolEntity) throw new Error(`School ${school} not found`);

  const { kadmosName, kadmosUsername, kadmosPassword } = schoolEntity;

  const jar = await login(kadmosName, kadmosUsername, kadmosPassword);
  const kadmosClasses = await getClasses(jar).then((classes) =>
    classes.map(mapKadmosClass),
  );

  const iservClient = createLazyIservClient();

  const entriesToInsert: ProtoTimetableEntry[] = [];
  for (const cls of kadmosClasses) {
    const timetable = await getTimetable(cls.id, date, jar);
    const entries = await collectEntries(timetable);
    entriesToInsert.push(...entries);
  }

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

    const joinedStart = Math.min(
      ...adjacentEntries.map((entry) => entry.start.getTime()),
    );
    const joinedEnd = Math.max(
      ...adjacentEntries.map((entry) =>
        add(entry.start, { minutes: entry.duration }).getTime(),
      ),
    );
    const joinedDuration = (joinedEnd - joinedStart) / 1000 / 60;

    const courseUuid = crypto
      .createHash("sha256")
      .update(school)
      .update(entry.course.kadmosId.toString())
      .update(
        joinedClasses
          .map((cls) => `${cls.startYear}.${cls.identifierInYear}`)
          .join(","),
      )
      .digest("hex")
      .slice(0, 32);

    await db
      .insert(Courses)
      .values({
        id: courseUuid,
        name: entry.course.name,
        longName: entry.course.longName,
        subject: entry.course.subject,
      })
      .onConflictDoUpdate({
        target: [Courses.id],
        set: {
          name: entry.course.name,
          longName: entry.course.longName,
          subject: entry.course.subject,
        },
      });

    const semester = await findSemesterFromDate(entry.start, school);
    await db
      .insert(SemesterCourses)
      .values({
        course: courseUuid,
        school,
        semesterType: semester.type,
        semesterYear: semester.year,
      })
      .onConflictDoNothing();

    await db
      .insert(SemesterCoursesToClasses)
      .values(
        joinedClasses.map((cls) => ({
          classIdentifier: cls.identifierInYear,
          classStartYear: cls.startYear,
          course: courseUuid,
          school,
          semesterType: semester.type,
          semesterYear: semester.year,
        })),
      )
      .onConflictDoNothing();

    for (const teacherName of joinedTeachers) {
      const personId = await iservClient.getOrCreateTeacher(teacherName);
      await db
        .insert(SemesterCoursesToTeachers)
        .values({
          teacher: personId,
          course: courseUuid,
          school,
          semesterType: semester.type,
          semesterYear: semester.year,
        })
        .onConflictDoNothing();
    }

    const startDate = new Date(joinedStart);

    await db
      .insert(TimetableEntries)
      .values({
        course: courseUuid,
        semesterType: semester.type,
        semesterYear: semester.year,
        start: startDate,
        school,
        duration: `${joinedDuration} minutes`,
      })
      .onConflictDoUpdate({
        target: [TimetableEntries.start, TimetableEntries.course],
        set: {
          semesterType: semester.type,
          semesterYear: semester.year,
          school,
          duration: `${joinedDuration} minutes`,
        },
      });

    if (joinedRooms.length > 0) {
      await db
        .insert(TimetableEntryRooms)
        .values(
          joinedRooms.map((room) => ({
            course: courseUuid,
            roomNumber: room,
            start: startDate,
          })),
        )
        .onConflictDoNothing();
    }
  }
};
