import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import type { courseTime } from "./schema";

export * from "./client";
export * from "./schema";
export * from "./relations";

import * as tables from "./schema";
import type { SubjectId } from "@stu/lib";
import { isArrayNonEmpty, subjectNameMap } from "@stu/lib";

export type CourseTime = Omit<
  typeof courseTime.$inferSelect,
  "id" | "courseId" | "createdAt" | "updatedAt"
>;

const findExistingCourseWeak = async (discoveredCourse: Course) => {
  const subjectLongName = subjectNameMap[discoveredCourse.name];

  const coursePlus = db
    .select({
      id: tables.course.id,
      courseId: tables.course.courseId,
      courseName: tables.course.name,
      classId: tables.course.classId,
      teacherAbbrv: tables.user.abbrv,
    })
    .from(tables.course)
    .innerJoin(
      tables.courseTime,
      eq(tables.course.id, tables.courseTime.courseId),
    )
    .innerJoin(tables.user, eq(tables.course.teacherId, tables.user.id))
    .where(
      and(
        eq(sql`lower(${tables.course.name})`, subjectLongName.toLowerCase()),
        inArray(
          sql`lower(${tables.user.abbrv})`,
          discoveredCourse.teachers
            .map((t) => t.abbrv?.toLowerCase())
            .filter((x) => x !== undefined),
        ),
      ),
    )
    .as("course_plus");

  const existingCourses = await db
    .select()
    .from(tables.year)
    .innerJoin(tables.clazz, eq(tables.clazz.yearId, tables.year.id))
    .leftJoin(coursePlus, eq(coursePlus.classId, tables.clazz.id))
    .where(
      and(
        eq(
          tables.clazz.identifierInYear,
          discoveredCourse.class.identifierInYear,
        ),
        eq(tables.year.startYear, discoveredCourse.class.startYear),
      ),
    );

  if (!isArrayNonEmpty(existingCourses)) {
    throw new Error(
      `Invalid state: Zero or multiple courses found for ${discoveredCourse.courseId} in ${discoveredCourse.class.identifierInYear} ${discoveredCourse.class.startYear}: ${JSON.stringify(existingCourses)}`,
    );
  }

  const [{ Year: year, Class: clazz, course_plus: existingCourse }] =
    existingCourses;

  return { year, clazz, existingCourse };
};

// Policy for finding existing courses:
// - Class HAS to match exactly
// - At least one of two conditions has to be met:
//    - the "course ID" (e.g. if23) matches case-insensetively
//    - subject name and teacher abbrv match
const findExistingCourse = async (discoveredCourse: Course) => {
  const fixedCourseId =
    discoveredCourse.courseId === "WPK O"
      ? "wpk"
      : discoveredCourse.courseId.toLowerCase();

  const coursePlus = db
    .select({
      id: tables.course.id,
      courseId: tables.course.courseId,
      courseName: tables.course.name,
      classId: tables.course.classId,
      teacherAbbrv: tables.user.abbrv,
    })
    .from(tables.course)
    .innerJoin(
      tables.courseTime,
      eq(tables.course.id, tables.courseTime.courseId),
    )
    .innerJoin(tables.user, eq(tables.course.teacherId, tables.user.id))
    .where(eq(sql`lower(${tables.course.courseId})`, fixedCourseId))
    .as("course_plus");

  const existingCourses = await db
    .select()
    .from(tables.year)
    .innerJoin(tables.clazz, eq(tables.clazz.yearId, tables.year.id))
    .leftJoin(coursePlus, eq(coursePlus.classId, tables.clazz.id))
    .where(
      and(
        eq(
          tables.clazz.identifierInYear,
          discoveredCourse.class.identifierInYear,
        ),
        eq(tables.year.startYear, discoveredCourse.class.startYear),
      ),
    );

  if (!isArrayNonEmpty(existingCourses)) {
    throw new Error(
      `Invalid state: Zero or multiple courses found for ${discoveredCourse.courseId} in ${discoveredCourse.class.identifierInYear} ${discoveredCourse.class.startYear}: ${JSON.stringify(existingCourses)}`,
    );
  }

  const [{ Year: year, Class: clazz, course_plus: existingCourse }] =
    existingCourses;

  return { year, clazz, existingCourse };
};

export interface Course {
  name: SubjectId; // human readable name, aka subject
  courseId: string; // short id (2 letters and number). cannot be sure this matches between old and new database
  courseTimes: Iterable<CourseTime>;
  teachers: {
    id: string;
    firstName: string;
    lastName: string;
    salutation: "Herr" | "Frau" | null;
    abbrv: string | null;
    email: string | null;
  }[];
  class: {
    identifierInYear: string;
    startYear: number;
  };
}

const insert = async (
  discoveredCourse: Course,
  yearId: number,
  classId: number,
) => {
  const fixedCourseId =
    discoveredCourse.courseId === "WPK O"
      ? "wpk"
      : discoveredCourse.courseId.toLowerCase();
  const teacherInput = discoveredCourse.teachers[0];
  if (!teacherInput) {
    throw new Error(
      `Invalid state: No teacher found for ${discoveredCourse.name}`,
    );
  }
  const teacher = await getOrCreateTeacher(teacherInput);
  const [course] = await db
    .insert(tables.course)
    .values({
      classId,
      name: subjectNameMap[discoveredCourse.name],
      courseId: fixedCourseId,
      teacherId: teacher,
      yearId,
      isChoosable: true,
    })
    .returning();
  if (!course) {
    throw new Error("Invalid state: Inserting course failed");
  }
  await db.insert(tables.courseTime).values(
    Array.from(discoveredCourse.courseTimes).map((ct) => ({
      courseId: course.id,
      duration: ct.duration,
      start: ct.start,
      weekday: ct.weekday,
    })),
  );
};

type Ret = Awaited<ReturnType<typeof findExistingCourse>>;

const getOrCreateTeacher = async (teacherInput: Course["teachers"][number]) => {
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
      throw new Error(
        `Invalid state: No teacher found for ${teacherInput.abbrv}`,
      );
    }
    return newTeacher.id;
  }
  return teacher.id;
};

const update = async (
  existingCourse: {
    clazz: Ret["clazz"];
    existingCourse: NonNullable<Ret["existingCourse"]>;
    year: Ret["year"];
  },
  discoveredCourse: Course,
) => {
  const fixedCourseId =
    discoveredCourse.courseId === "WPK O"
      ? "wpk"
      : discoveredCourse.courseId.toLowerCase();
  const teacherInput = discoveredCourse.teachers[0];
  if (!teacherInput) {
    throw new Error(
      `Invalid state: No teacher found for ${discoveredCourse.name}`,
    );
  }
  const newTeacherId = await getOrCreateTeacher(teacherInput);
  await db
    .update(tables.course)
    .set({
      name: subjectNameMap[discoveredCourse.name],
      courseId: fixedCourseId,
      teacherId: newTeacherId,
    })
    .where(eq(tables.course.id, existingCourse.existingCourse.id));
  for (const courseTime of discoveredCourse.courseTimes) {
    const existingCourseTime = await db.query.courseTime.findFirst({
      where: and(
        eq(tables.courseTime.courseId, existingCourse.existingCourse.id),
        eq(tables.courseTime.weekday, courseTime.weekday),
        eq(tables.courseTime.start, courseTime.start),
        eq(tables.courseTime.weeks, courseTime.weeks),
      ),
    });
    if (existingCourseTime) {
      continue;
    }
    await db.insert(tables.courseTime).values({
      courseId: existingCourse.existingCourse.id,
      duration: courseTime.duration,
      start: courseTime.start,
      weekday: courseTime.weekday,
      weeks: courseTime.weeks,
    });
  }
};

export const upsertCourses = async (courses: Course[]) => {
  let unknownCount = 0;

  for (const discoveredCourse of courses) {
    const { clazz, existingCourse, year } =
      await findExistingCourse(discoveredCourse);

    if (existingCourse) {
      await update(
        {
          clazz,
          existingCourse,
          year,
        },
        discoveredCourse,
      );
    } else {
      const { existingCourse: existingCourseWeak } =
        await findExistingCourseWeak(discoveredCourse);

      if (!existingCourseWeak) {
        console.log(`Not found: ${JSON.stringify(discoveredCourse)}`);
        unknownCount++;
        await insert(discoveredCourse, year.id, clazz.id);
      } else {
        await update(
          {
            clazz,
            existingCourse: existingCourseWeak,
            year,
          },
          discoveredCourse,
        );
      }
    }
    if (existingCourse) {
      // // todo: update course
      // const existingCourseTimes = await db
      //   .select()
      //   .from(tables.courseTime)
      //   .where(eq(tables.courseTime.courseId, existingCourse.courseId));
      // for (const courseTime of discoveredCourse.courseTimes) {
      //   if (
      //     existingCourseTimes.find(
      //       (ct) =>
      //         ct.weekday === courseTime.weekday &&
      //         ct.start === courseTime.start &&
      //         ct.weeks === courseTime.weeks,
      //     )
      //   ) {
      //     continue;
      //   }
      //   console.log(existingCourseTimes);
      //   console.log(
      //     year.id,
      //     clazz.id,
      //     "->",
      //     year.name,
      //     year.graduationYear,
      //     clazz.identifierInYear,
      //     discoveredCourse,
      //   );
      //   console.log("ADDING", courseTime);
      // }
    } else {
      // todo: insert course
      // console.log(
      //   year.id,
      //   clazz.id,
      //   "->",
      //   year.name,
      //   year.graduationYear,
      //   clazz.identifierInYear,
      //   discoveredCourse,
      // );
      // unknownCount++;
    }
  }
  console.log(`Unknown courses: ${unknownCount}`);
};
