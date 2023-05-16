import fs from "fs/promises";
import p from "path";
import dayjs from "dayjs";
import z from "zod";

import { prisma } from "@acme/db";
import { parseTable } from "../../../packages/common/src/substitutions/parseSubstitutionPlan";

const substitutionsDir = "./cache/substitutions";

const main = async () => {
  for (const fileName of await fs.readdir(substitutionsDir)) {
    const filePath = p.join(substitutionsDir, fileName);

    const parsed = await parseTable(filePath);

    for (const substitution of parsed) {
      for (const class_ of substitution.classes ?? []) {
        const yearNum = parseInt(class_.split(".")[0] ?? "-1");
        const identifierInYear = class_.split(".")[1];

        const today = new Date();
        let startYear = today.getFullYear() - yearNum + 5;
        if (today.getMonth() < 7) startYear--;

        const dbYear = await prisma.year.findFirst({
          where: {
            startYear,
          },
        });

        if (!dbYear) {
          console.error(`Could not find year for ${class_}`);
          continue;
        }

        const dbClass = await prisma.class.findFirst({
          where: {
            yearId: dbYear.id,
            identifierInYear,
          },
        });

        if (!dbClass) {
          console.error(`Could not find class for ${class_}`);
          continue;
        }

        const dbCourse = await prisma.course.findFirst({
          where: {
            yearId: dbYear.id,
            classId: dbClass.id,
            courseId: substitution.readableSubject?.toLowerCase(),
          },
        });

        if (!dbCourse) {
          console.error(
            `Could not find course for class ${class_}: ${substitution.readableSubject}`,
          );
          continue;
        }

        const typeSchema = z.enum([
          "FREISETZUNG",
          "VERTRETUNG",
          "BETREUUNG",
          "ENTFALL",
        ]);
        const type = typeSchema.safeParse(substitution.type?.toUpperCase());

        if (!type.success) {
          console.error(
            `Could not parse type for ${class_}: ${substitution.type}`,
          );
          continue;
        }

        const res = await prisma.substitution.upsert({
          where: {
            substitutionIdentifier: {
              date: substitution.date.toDate(),
              lessonStart: substitution.lessonStart,
              courseId: dbCourse.id,
            },
          },
          create: {
            date: substitution.date.toDate(),
            lessonStart: substitution.lessonStart,
            lessonEnd: substitution.lessonEnd,
            course: {
              connect: {
                id: dbCourse.id,
              },
            },
            room: substitution.room,
            type: type.data,
          },
          update: {
            date: substitution.date.toDate(),
            lessonStart: substitution.lessonStart,
            lessonEnd: substitution.lessonEnd,
            course: {
              connect: {
                id: dbCourse.id,
              },
            },
            room: substitution.room,
            type: type.data,
          },
        });

        const isNew = dayjs(res.updatedAt).diff(res.createdAt) < 1000;

        if (isNew) {
          console.log(
            `Created substitution ${substitution.date.format("YYYY-MM-DD")} ${
              substitution.lessonStart
            } ${substitution.lessonEnd} ${
              substitution.type
            } ${substitution.readableSubject} ${class_}`,
          );
        }
      }
    }
  }
};

void main();
