import type { PrismaClient } from "@prisma/client";

import type { MakeRequest } from "@schnau/external-api";
import type { Class } from "@schnau/lib";
import { findAbbrvName } from "@schnau/external-api";

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
  room: string;
  isChoosable: boolean;
  times: ProtoCourseTime[];
}

export const insertProtoCourse = async (
  db: PrismaClient,
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

  const teacherValue = {
    abbrv: teacher,
    name: teacherMatch.name,
    email: teacherMatch.email,
  };

  await db.course.upsert({
    where: {
      courseIdentifier: {
        courseId: normalizedCourseId,
        room,
        semesterId,
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
      classes: {
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
      classes: {
        connect: {
          id: clazz.id,
        },
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
