import { and, eq } from "drizzle-orm";
import { db } from "./client";

export * from "./client";
export * from "./relations";
export * from "./schema";

import type { DiscoveredCourse, DiscoveredTeacher } from "@stu/db";
import { type CourseTimeWeeks, subjectNameMap, Year } from "@stu/lib";
import * as tables from "./schema";

const insert = async (discoveredCourse: DiscoveredCourse, yearId: number, classId: number) => {
  const teacherInput = discoveredCourse.teachers[0];
  if (!teacherInput) {
    // throw new Error(`Invalid state: No teacher found for ${discoveredCourse.name}`);
    console.warn(`No teacher found for ${discoveredCourse.name}`);
    return;
  }
  const teacher = await getOrCreateTeacher(teacherInput);
  const [course] = await db
    .insert(tables.course)
    .values({
      classId,
      name: subjectNameMap[discoveredCourse.name],
      courseId: discoveredCourse.courseId,
      teacherId: teacher,
      yearId,
      isChoosable: true,
    })
    .onConflictDoUpdate({
      target: [tables.course.classId, tables.course.courseId, tables.course.yearId],
      set: {
        name: subjectNameMap[discoveredCourse.name],
        teacherId: teacher,
        isChoosable: true,
      },
    })
    .returning();
  if (!course) {
    throw new Error("Invalid state: Inserting course failed");
  }
  for (const ct of discoveredCourse.courseTimes) {
    let weeks: CourseTimeWeeks = "BOTH";
    if (ct.weeks.EVEN === 0) {
      weeks = "ODD";
    }
    if (ct.weeks.ODD === 0) {
      weeks = "EVEN";
    }

    const existingCourseTime = await db.query.courseTime.findFirst({
      where: and(
        eq(tables.courseTime.courseId, course.id),
        eq(tables.courseTime.weekday, ct.weekday),
        eq(tables.courseTime.start, ct.start),
        eq(tables.courseTime.weeks, weeks),
      ),
    });
    if (existingCourseTime) {
      continue;
    }

    await db.insert(tables.courseTime).values({
      courseId: course.id,
      duration: ct.duration,
      start: ct.start,
      weekday: ct.weekday,
      weeks,
    });
  }
};

const getOrCreateTeacher = async (teacherInput: DiscoveredTeacher) => {
  if (!teacherInput.abbrv) {
    throw new Error(
      `Invalid state: No teacher abbreviation found for ${teacherInput.firstName} ${teacherInput.lastName}`,
    );
  }
  const teacher = await db.query.user.findFirst({
    where: eq(tables.user.abbrv, teacherInput.abbrv),
  });
  if (!teacher) {
    const [newTeacher] = await db
      .insert(tables.user)
      .values({
        name: `${teacherInput.firstName} ${teacherInput.lastName}`,
        abbrv: teacherInput.abbrv,
        role: "TEACHER" as const,
        updatedAt: new Date().toISOString(),
      })
      .returning();
    if (!newTeacher) {
      throw new Error(`Invalid state: No teacher found for ${teacherInput.abbrv}`);
    }
    return newTeacher.id;
  }
  return teacher.id;
};

const SCHOOL_ID = 1;

const upsertYear = async (startYear: number) => {
  const existingYear = await db.query.year.findFirst({
    where: eq(tables.year.startYear, startYear),
  });

  if (existingYear) {
    return existingYear.id;
  }

  const [newYear] = await db
    .insert(tables.year)
    .values({
      startYear,
      schoolId: SCHOOL_ID,
      graduationYear: startYear + 9,
      name: Year.getYearName({ startYear }) ?? startYear.toString(),
    })
    .returning();
  if (!newYear) {
    throw new Error(`Failed to create year ${startYear}`);
  }

  return newYear.id;
};

const upsertClass = async (identifierInYear: string, yearId: number) => {
  const existingClass = await db.query.clazz.findFirst({
    where: and(eq(tables.clazz.identifierInYear, identifierInYear), eq(tables.clazz.yearId, yearId)),
  });
  if (existingClass) {
    return existingClass.id;
  }
  const [newClass] = await db
    .insert(tables.clazz)
    .values({
      identifierInYear,
      yearId,
    })
    .returning();
  if (!newClass) {
    throw new Error(`Failed to create class ${identifierInYear}`);
  }
  return newClass.id;
};

export const upsertCourses = async (courses: DiscoveredCourse[]) => {
  for (const discoveredCourse of courses) {
    const yearId = await upsertYear(discoveredCourse.class.startYear);
    const classId = await upsertClass(discoveredCourse.class.identifierInYear, yearId);

    await insert(discoveredCourse, yearId, classId);
  }
};
