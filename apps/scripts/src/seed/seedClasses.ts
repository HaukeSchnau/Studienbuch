import fs from "fs/promises";
import p from "path";
import Papa from "papaparse";
import { z } from "zod";

import { guessSubject } from "@acme/common";
import { prisma } from "@acme/db";

import { years } from "./years";

const parseCourses = (coursesRaw: string) => {
  const coursesForDay = coursesRaw
    .split("\n")
    .filter((course) => course.trim());

  const coursesForDayProcessed: {
    subject: string;
    guessedSubject: string;
    teacher: string;
    room?: string;
  }[] = [];

  for (let i = 0; i < coursesForDay.length; i++) {
    const course = coursesForDay[i];
    const components =
      course?.split(" ").filter((course) => course.trim()) ?? [];

    while (
      components.length == 1 ||
      (components.length < 3 &&
        !coursesForDay[i + 1]?.startsWith("*") &&
        i + 1 < coursesForDay.length)
    ) {
      components.push(
        ...(coursesForDay[i + 1]
          ?.split(" ")
          .filter((course) => course.trim()) ?? []),
      );
      i++;
    }

    const [subject, teacher, room] = components;
    const guessedSubject = guessSubject(subject);

    coursesForDayProcessed.push(
      z
        .object({
          subject: z.string(),
          guessedSubject: z.string(),
          teacher: z.string(),
          room: z.string().optional(),
        })
        .parse({
          subject,
          guessedSubject,
          teacher,
          room,
        }),
    );
  }

  return coursesForDayProcessed;
};

const parseTime = (time: string) => {
  return (
    parseInt(time.split(":")?.[0] ?? "0") * 60 +
    parseInt(time.split(":")?.[1] ?? "0")
  );
};

const getKnownUsers = async () => {
  const csv = await fs
    .readFile("./known-users.csv", "utf8");
  const data = Papa.parse(csv, { header: true });
  
  const users = data.data.map((row) => z
    .object({
      abbrv: z.string(),
      name: z.string(),
      title: z.string(),
    })
    .safeParse(row));

  return users
    .filter(
      (user) => user.success &&
        user.data.abbrv !== user.data.name &&
        user.data.name &&
        user.data.title)
    .map((user_1) => user_1.success && user_1.data)
    .filter(Boolean);
};

const parseFile = async (filepath: string) => {
  const fileContents = await fs.readFile(filepath, "utf8");
  const { data } = Papa.parse(fileContents, { header: true });

  const basename = p.basename(filepath, ".csv");
  const yearName = basename.split("-")[0];
  const idInYear = basename.split("-")[1];

  if (!yearName) throw new Error(`No year found in ${p.basename(filepath)}`);

  const year = years.find(
    (candidate) => candidate.name.toLowerCase() === yearName?.toLowerCase(),
  );
  if (!year) throw new Error(`No year found for ${yearName}`);

  const rowSchema = z.object({
    "": z.string(),
    Montag: z.string(),
    Dienstag: z.string(),
    Mittwoch: z.string(),
    Donnerstag: z.string(),
    Freitag: z.string(),
  });

  const typedTable = data
    .map((row) => {
      const parsed = rowSchema.safeParse(row);
      if (parsed.success) return parsed.data;
    })
    .filter(Boolean)
    .map((row) => {
      const { Montag, Dienstag, Mittwoch, Donnerstag, Freitag } = row;

      const time = row[""];
      const [start, end] = time.split("\n");
      const startMinutes = parseTime(start ?? "0");
      const endMinutes = parseTime(end ?? "0");

      const days = [Montag, Dienstag, Mittwoch, Donnerstag, Freitag].map(
        (coursesRaw) => {
          if (!coursesRaw) return [];

          const coursesForDay = parseCourses(coursesRaw);
          return coursesForDay;
        },
      );

      return {
        startMinutes,
        endMinutes,
        days,
      };
    });

  return { year, idInYear, data: typedTable };
};

export const seedClasses = async () => {
  const knownUsers = await getKnownUsers();

  const path = "./cache/classes_csv";
  const filenames = await fs.readdir(path);

  for (const filename of filenames.filter((filename) =>
    filename.endsWith(".csv"),
  )) {
    const { year, idInYear, data } = await parseFile(p.join(path, filename));

    const dbYear = await prisma.year.upsert({
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

    const dbClass = await prisma.class.upsert({
      where: {
        classIdentifier: {
          identifierInYear: idInYear ?? "",
          yearId: dbYear.id,
        },
      },
      create: {
        identifierInYear: idInYear ?? "",
        year: {
          connect: {
            id: dbYear.id,
          },
        },
      },
      update: {},
    });

    for (const row of data) {
      for (const [dayNum, coursesForDay] of row.days.entries()) {
        for (const course of coursesForDay) {
          const { subject, guessedSubject, teacher, room } = course;
          const normalizedCourseIdentifier = subject
            .replaceAll("*", "")
            .toLowerCase();

          const isChoosable = subject.startsWith("*");

          const knownTeacher = knownUsers.find(
            (user) => user.abbrv === teacher,
          );

          await prisma.courseTime.create({
            data: {
              start: row.startMinutes,
              duration: row.endMinutes - row.startMinutes,
              weekday: dayNum + 1,
              course: {
                connectOrCreate: {
                  where: {
                    courseIdentifier: {
                      courseId: normalizedCourseIdentifier,
                      yearId: dbYear.id,
                      classId: dbClass.id,
                    },
                  },
                  create: {
                    name: guessedSubject,
                    courseId: normalizedCourseIdentifier,
                    room,
                    isChoosable,
                    year: {
                      connect: {
                        id: dbYear.id,
                      },
                    },
                    teacher: {
                      connectOrCreate: {
                        where: {
                          abbrv: teacher,
                        },
                        create: {
                          abbrv: teacher,
                          name: knownTeacher?.name ?? teacher,
                          title: knownTeacher?.title,
                          role: "TEACHER",
                        },
                      },
                    },
                    class: {
                      connect: {
                        id: dbClass.id,
                      },
                    },
                  },
                },
              },
            },
          });
        }
      }
    }
  }
};
