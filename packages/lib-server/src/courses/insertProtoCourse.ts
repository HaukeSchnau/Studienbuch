import type { MakeRequest } from "@stu/external-api";
import type { Class } from "@stu/lib";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Course, CourseTime, User } from "@stu/db/schema";
import { findAbbrvName } from "@stu/external-api";

interface ProtoCourseTime {
  weekday: number;
  start: number;
  duration: number;
  weeks: "ODD" | "EVEN" | "BOTH";
}

interface ProtoCourse {
  teacher: string;
  normalizedCourseId: string;
  guessedSubject: string;
  room?: string;
  isChoosable: boolean;
  times: ProtoCourseTime[];
}

export const insertProtoCourse = async (
  clazz: Class,
  semesterId: string,
  course: ProtoCourse,
  makeIservRequest: MakeRequest,
) => {
  const {
    teacher,
    normalizedCourseId,
    guessedSubject,
    room,
    isChoosable,
    times,
  } = course;

  const teacherMatch = (await findAbbrvName(makeIservRequest, teacher)) ?? {
    name: teacher,
    email: undefined,
  };

  const [dbTeacher] = await db
    .insert(User)
    .values({
      abbrv: teacher,
      name: teacherMatch.name,
      email: teacherMatch.email,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: User.abbrv,
      set: {
        name: teacherMatch.name,
        email: teacherMatch.email,
        updatedAt: new Date(),
      },
    })
    .returning()
    .execute();

  if (!dbTeacher) {
    throw new Error(`Could not create teacher ${teacher}`);
  }

  const existingCourse = await db.query.Course.findFirst({
    where: eq(Course.courseId, normalizedCourseId),
  });

  if (existingCourse) {
    await db
      .delete(CourseTime)
      .where(eq(CourseTime.courseId, existingCourse.id));
  }

  if (existingCourse) {
    await db
      .update(Course)
      .set({
        name: guessedSubject,
        courseId: normalizedCourseId,
        room,
        isChoosable,
        teacherId: dbTeacher.id,
        classId: clazz.id,
        semesterId,
        updatedAt: new Date(),
      })
      .where(eq(Course.id, existingCourse.id));

    await insertCourseTimes(existingCourse.id, times);
  } else {
    const [newCourse] = await db
      .insert(Course)
      .values({
        name: guessedSubject,
        courseId: normalizedCourseId,
        room,
        isChoosable,
        teacherId: dbTeacher.id,
        classId: clazz.id,
        semesterId,
        updatedAt: new Date(),
      })
      .returning()
      .execute();

    if (!newCourse) {
      throw new Error(`Could not create course ${normalizedCourseId}`);
    }

    await insertCourseTimes(newCourse.id, times);
  }
};

const insertCourseTimes = async (
  courseId: number,
  times: ProtoCourseTime[],
) => {
  await db.insert(CourseTime).values(
    times.map((time) => ({
      weekday: time.weekday,
      start: time.start,
      duration: time.duration,
      weeks: time.weeks,
      courseId,
      updatedAt: new Date(),
    })),
  );
};
