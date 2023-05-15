import fs from "fs/promises";
import p from "path";
import Papa from "papaparse";
import z from "zod";

import { prisma } from "@acme/db";

import { years } from "./years";

const courseNames = [
  "Deutsch",
  "Englisch",
  "Mathe",
  "Physik",
  "Chemie",
  "Biologie",
  "Informatik",
  "Geschichte",
  "Politik-Wirtschaft",
  "Musik",
  "Sport",
  "Kunst",
  "Religion",
  "Werte und Normen",
  "Französisch",
  "Latein",
  "Spanisch",
  "Sport-Theorie",
  "Seminarfach",
];

const guessSubject = (subject: string | undefined) => {
  const regex = /^\*?([^0-9]+)[0-9]*$/;
  const matches = regex.exec(subject ?? "");

  if (!matches) return subject?.trim().replaceAll("*", "");

  const parsedSubject = matches[1];

  if (!parsedSubject) return subject?.trim().replaceAll("*", "");

  const subjectLower = parsedSubject.trim().toLowerCase();

  if (subjectLower.startsWith("wn") || subjectLower.startsWith("wun"))
    return "Werte und Normen";

  if (subjectLower === "ds") return "Darstellendes Spiel";
  if (subjectLower === "sn") return "Spanisch";
  if (subjectLower === "pw") return "Politik-Wirtschaft";
  if (subjectLower === "if") return "Informatik";
  if (subjectLower === "sf") return "Seminarfach";

  return (
    courseNames.find((candidate) =>
      candidate.toLowerCase().startsWith(subjectLower),
    ) ?? parsedSubject
  );
};

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

export const seedClasses = async () => {
  const path = "./cache/classes_csv";
  const filenames = await fs.readdir(path);

  const rowSchema = z.object({
    "": z.string(),
    Montag: z.string(),
    Dienstag: z.string(),
    Mittwoch: z.string(),
    Donnerstag: z.string(),
    Freitag: z.string(),
  });

  for (const filename of filenames.filter((filename) =>
    filename.endsWith(".csv"),
  )) {
    const fileContents = await fs.readFile(p.join(path, filename), "utf8");
    const { data } = Papa.parse(fileContents, { header: true });

    const parsed = data.map((row) => rowSchema.safeParse(row));

    const basename = p.basename(filename, ".csv");
    const yearName = basename.split("-")[0];
    const idInYear = basename.split("-")[1];

    if (!yearName) throw new Error(`No year found in ${filename}`);

    const year = years.find(
      (candidate) => candidate.name.toLowerCase() === yearName?.toLowerCase(),
    );
    if (!year) throw new Error(`No year found for ${yearName}`);

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

    for (const row of parsed) {
      if (!row.success) continue;

      const { data } = row;
      const { Montag, Dienstag, Mittwoch, Donnerstag, Freitag } = data;

      const time = data[""];
      const [start, end] = time.split("\n");
      const startMinutes = parseTime(start ?? "0");
      const endMinutes = parseTime(end ?? "0");

      for (const [dayNum, coursesRaw] of [
        Montag,
        Dienstag,
        Mittwoch,
        Donnerstag,
        Freitag,
      ].entries()) {
        if (!coursesRaw) continue;

        const coursesForDay = parseCourses(coursesRaw);

        for (const course of coursesForDay) {
          const { subject, guessedSubject, teacher, room } = course;
          const normalizedCourseIdentifier = subject
            .replaceAll("*", "")
            .toLowerCase();

          const isChoosable = subject.startsWith("*");

          await prisma.courseTime.create({
            data: {
              start: startMinutes,
              duration: endMinutes - startMinutes,
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
                          name: teacher,
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
