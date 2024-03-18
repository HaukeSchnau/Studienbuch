import type { PrismaClient } from "@prisma/client";

import type { Class, Year } from "@schnau/lib";

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
  db: PrismaClient,
  year: Year,
  clazz: Class,
  course: ProtoCourse,
) => {
  const {
    teacher,
    normalizedCourseId,
    guessedSubject,
    room,
    isChoosable,
    times,
  } = course;

  const teacherValue = {
    abbrv: teacher,
    name: teacher,
  };

  await db.course.upsert({
    where: {
      courseIdentifier: {
        courseId: normalizedCourseId,
        yearId: year.id,
        classId: clazz.id,
      },
    },
    create: {
      name: guessedSubject,
      courseId: normalizedCourseId,
      room,
      isChoosable,
      teacher: {
        connectOrCreate: {
          where: {
            abbrv: teacher,
          },
          create: teacherValue,
        },
      },
      year: {
        connect: {
          id: year.id,
        },
      },
      class: {
        connect: {
          id: clazz.id,
        },
      },
      times: {
        create: times,
      },
    },
    update: {
      name: guessedSubject,
      room,
      isChoosable,
      times: {
        deleteMany: {},
        create: times,
      },
      teacher: {
        connectOrCreate: {
          where: {
            abbrv: teacher,
          },
          create: teacherValue,
        },
      },
    },
  });
};
