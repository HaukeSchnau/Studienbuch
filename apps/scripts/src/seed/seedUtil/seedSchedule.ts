import { db } from "@schnau/db";

import { type KnownUser } from "./getKnownUsers";
import { type ScheduleInfo } from "./parseScheduleCsv";
import { generateHashedPassword } from "./generateHashedPassword";

export const seedSchedule = async (
  { year, idInYear, courses }: ScheduleInfo,
  knownUsers: KnownUser[],
) => {
  const dbYear = await db.year.upsert({
    where: {
      startYear: year.startYear,
    },
    create: {
      startYear: year.startYear,
      graduationYear: year.startYear + 9,
      name: year.name,
    },
    update: {},
  });

  const dbClass = await db.class.upsert({
    where: {
      classIdentifier: {
        identifierInYear: idInYear,
        yearId: dbYear.id,
      },
    },
    create: {
      identifierInYear: idInYear,
      year: {
        connect: {
          id: dbYear.id,
        },
      },
    },
    update: {},
  });

  for (const {
    normalizedCourseId,
    isChoosable,
    room,
    guessedSubject,
    teacher,
    times,
  } of courses) {
    const knownTeacher = knownUsers.find((user) => user.abbrv === teacher);

    await db.course.upsert({
      where: {
        courseIdentifier: {
          courseId: normalizedCourseId,
          yearId: dbYear.id,
          classId: dbClass.id,
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
            create: {
              abbrv: teacher,
              email: `${
                  teacher.toLowerCase().replaceAll(" ", ".")
                }@igslilienthal.de`,
              passwordHash: await generateHashedPassword(),
              name: knownTeacher?.name ?? teacher,
              title: knownTeacher?.title,
              role: "TEACHER",
            },
          },
        },
        year: {
          connect: {
            id: dbYear.id,
          },
        },
        class: {
          connect: {
            id: dbClass.id,
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
            create: {
              abbrv: teacher,
              email: `${
                  teacher.toLowerCase().replaceAll(" ", ".")
                }@igslilienthal.de`,
              passwordHash: await generateHashedPassword(),
              name: knownTeacher?.name ?? teacher,
              title: knownTeacher?.title,
              role: "TEACHER",
            },
          },
        },
      },
    });
  }
};
