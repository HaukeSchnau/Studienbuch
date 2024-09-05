import crypto from "crypto";
import { add } from "date-fns";

import type { SchoolId } from "@stu/lib";
import { and, eq, gte, lte } from "@stu/db";
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
import { BetterMap, guessSubject, isArraySingleElement } from "@stu/lib";

import { createLazyIservClient } from "../lazy-iserv-client";
import { mapKadmosClass } from "./map-kadmos-class";

interface Options {
  school: SchoolId;
  date: Date;
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

  const iservClient = createLazyIservClient();

  for (const cls of kadmosClasses) {
    const { elementPeriods, elements } = await getTimetable(cls.id, date, jar);

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

    for (const period of Object.values(elementPeriods).flat()) {
      const semester = await findSemesterFromDate(period.date, school);

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

      //// COURSE
      const [course] = periodCourses;
      const courseIdHex = course.id.toString(16).padStart(8, "0");
      const schoolIdHex = crypto
        .createHash("sha256")
        .update(school)
        .digest("hex")
        .slice(0, 24);
      const courseUuid = `${schoolIdHex}${courseIdHex}`;

      const subject = guessSubject(course.name);

      if (!subject) {
        console.warn(
          `Unknown subject: "${course.name}". Skipping this course.`,
        );
        continue;
      }

      await db
        .insert(Courses)
        .values({
          id: courseUuid,
          name: course.name,
          longName: course.longName,
          subject,
        })
        .onConflictDoUpdate({
          target: [Courses.id],
          set: {
            name: course.name,
            longName: course.longName,
            subject,
          },
        });

      await db
        .insert(SemesterCourses)
        .values({
          course: courseUuid,
          school,
          semesterType: semester.type,
          semesterYear: semester.year,
        })
        .onConflictDoUpdate({
          target: [
            SemesterCourses.course,
            SemesterCourses.semesterType,
            SemesterCourses.semesterYear,
            SemesterCourses.school,
          ],
          set: {
            isChoosable: true,
          },
        }); // TODO: Update isChoosable here
      //// END COURSE

      //// CLASSES
      for (const cls of periodClasses) {
        const mappedClass = mapKadmosClass(cls);

        await db
          .insert(SemesterCoursesToClasses)
          .values({
            classIdentifier: mappedClass.identifierInYear,
            classStartYear: mappedClass.startYear,
            course: courseUuid,
            school,
            semesterType: semester.type,
            semesterYear: semester.year,
          })
          .onConflictDoNothing();
      }

      //// TEACHERS
      for (const teacher of periodTeachers) {
        if (teacher.name === "---") {
          continue;
        }
        const personId = await iservClient.getOrCreateTeacher(teacher.name);
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
      //// END TEACHERS

      //// ROOM
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
      //// END ROOM

      const timetableEntry: typeof TimetableEntries.$inferInsert = {
        start: add(period.date, { minutes: period.startTime, hours: 2 }), // TODO: Timezone
        duration: `${period.endTime - period.startTime} minutes`,
        school,
        semesterType: semester.type,
        semesterYear: semester.year,
        course: courseUuid,
      };

      await db
        .insert(TimetableEntries)
        .values(timetableEntry)
        .onConflictDoUpdate({
          target: [TimetableEntries.start, TimetableEntries.course],
          set: {
            duration: timetableEntry.duration,
            semesterType: timetableEntry.semesterType,
            school: timetableEntry.school,
            semesterYear: timetableEntry.semesterYear,
          },
        });

      if (period.cellState === "SUBSTITUTION") {
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
      }

      if (periodRooms.length > 0) {
        await db
          .insert(TimetableEntryRooms)
          .values(
            periodRooms.map((room) => ({
              start: timetableEntry.start,
              course: courseUuid,
              roomNumber: room.name,
            })),
          )
          .onConflictDoNothing();
      }
    }
  }
};
