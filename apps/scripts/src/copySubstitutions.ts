import fs from "fs/promises";
import p from "path";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import firebase from "firebase-admin";
import { applicationDefault } from "firebase-admin/app";
import Papa from "papaparse";
import z from "zod";

import {
  capitalize,
  CourseWithoutTimes,
  formalName,
  Substitution,
} from "@acme/common";
import { db } from "@acme/db";

dayjs.extend(utc);

const substitutionsDir = "./cache/substitutions_csv";

const parseFile = async (filepath: string) => {
  const csv = await fs.readFile(filepath, "utf8");
  const { data } = Papa.parse(csv, {
    header: true,
  });

  const filename = p.basename(filepath, ".csv");
  const dateString = filename.split("-").slice(0, 3).join("-");
  const date = dayjs.utc(dateString, "YYYY-MM-DD");

  const rowSchema = z
    .object({
      Stunde: z.string(),
      "Klasse(n)": z.string(),
      "(Fach)": z.string(),
      Raum: z.string(),
      Art: z.string(),
    })
    .transform((user) => ({
      date,
      stundeStr: user.Stunde,
      classesStr: user["Klasse(n)"],
      subject: user["(Fach)"].toLowerCase().replaceAll("- ", "-"),
      room: user.Raum === "---" ? undefined : user.Raum,
      type: user.Art,
    }));

  return data
    .map((row) => {
      const parsed = rowSchema.safeParse(row);
      // {"Stunde":""} is a known error in the csv. Ignore it.
      if (!parsed.success && JSON.stringify(row) !== '{"Stunde":""}') {
        console.warn("WARNING: Could not parse row: " + JSON.stringify(row));
      }
      if (parsed.success) return parsed.data;
    })
    .filter(Boolean)
    .map((row) => {
      const { date, stundeStr, classesStr, subject, room, type } = row;
      let lessonStart = -1;
      let lessonEnd = -1;
      if (stundeStr) {
        if (stundeStr.includes("-")) {
          const split = stundeStr.split("-");
          lessonStart = parseInt(split[0] || "-1");
          lessonEnd = parseInt(split[1] || "-1");
        } else if (stundeStr.includes("/")) {
          const split = stundeStr.split("/");
          lessonStart = parseInt(split[0] || "-1");
          lessonEnd = parseInt(split[1] || "-1");
        } else {
          lessonStart = parseInt(stundeStr);
          lessonEnd = parseInt(stundeStr);
        }
        lessonStart -= 1;
        lessonEnd -= 1;
      }

      if (isNaN(lessonStart) || isNaN(lessonEnd)) {
        console.log("Failed to parse row: " + JSON.stringify(row));
        return null;
      }

      const classes = classesStr
        ? trim(trim(classesStr, "("), ")")
            .trim()
            .split(",")
            .map((e) => trim(e, ".").trim())
            .filter((e) => e)
        : undefined;

      return {
        date,
        lessonStart,
        lessonEnd,
        classes,
        subject,
        room,
        type,
      };
    })
    .filter(Boolean);
};

// Returns the number of subscribers that were notified
const notifySubscribers = async (
  app: firebase.app.App,
  substitution: Substitution,
  course: CourseWithoutTimes,
) => {
  // Don't notify for substitutions in the past
  if (substitution.date.getTime() < Date.now()) return 0;

  const subscriptions = await db.courseSubscription.findMany({
    where: {
      courseId: course.id,
    },
  });

  for (const subscription of subscriptions) {
    await app.messaging().send({
      notification: {
        title: `Vertretungsplan: ${course.name} bei ${formalName(
          course.teacher,
        )}`,
        body: `${capitalize(substitution.type)} am ${dayjs(
          substitution.date,
        ).format("DD.MM.")}`,
      },
      token: subscription.messagingToken,
    });

    console.log(
      `Sent notification to ${subscription.messagingToken} for ${course.courseId} (ID: ${course.id})`,
    );
  }

  return subscriptions.length;
};

const main = async () => {
  const app = firebase.initializeApp({
    credential: applicationDefault(),
    databaseURL: "https://de-haukeschnau-classmate.firebaseio.com",
  });

  for (const fileName of await fs.readdir(substitutionsDir)) {
    const filePath = p.join(substitutionsDir, fileName);
    const filename = p.basename(filePath, ".csv");

    let createdCount = 0;
    let updatedCount = 0;

    const substitutions = await parseFile(filePath);

    for (const substitution of substitutions) {
      for (const class_ of substitution.classes ?? []) {
        const yearNum = parseInt(class_.split(".")[0] ?? "-1");
        const identifierInYear = class_.split(".")[1];

        const today = new Date();
        let startYear = today.getFullYear() - yearNum + 5;
        if (today.getMonth() < 7) startYear--;

        const dbYear = await db.year.findFirst({
          where: {
            startYear,
          },
        });

        if (!dbYear) {
          // console.error(`Could not find year for ${class_}`);
          continue;
        }

        const dbClass = await db.class.findFirst({
          where: {
            yearId: dbYear.id,
            identifierInYear,
          },
        });

        if (!dbClass) {
          // console.error(`Could not find class for ${class_}`);
          continue;
        }

        const dbCourse = await db.course.findFirst({
          where: {
            yearId: dbYear.id,
            classId: dbClass.id,
            courseId: substitution.subject?.toLowerCase(),
          },
          include: {
            teacher: true,
          },
        });

        if (!dbCourse) {
          // console.error(
          //   `Could not find course for class ${class_}: ${substitution.subject}`,
          // );
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

        const res = await db.substitution.upsert({
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
          const notifiedCount = await notifySubscribers(app, res, dbCourse);

          console.log(
            `Created substitution ${substitution.date.format("YYYY-MM-DD")} ${
              substitution.lessonStart
            } ${substitution.lessonEnd} ${substitution.type} ${
              substitution.subject
            } ${class_} and notified ${notifiedCount} subscribers`,
          );
          createdCount++;
        } else {
          updatedCount++;
        }
      }
    }

    console.log(
      `${dayjs().format(
        "YYYY-MM-DD HH:mm",
      )}: Finished ${filename} (created: ${createdCount}, updated: ${updatedCount})`,
    );
  }
};

void main();

function trim(str: string, ch: string) {
  let start = 0,
    end = str.length;

  while (start < end && str[start] === ch) ++start;

  while (end > start && str[end - 1] === ch) --end;

  return start > 0 || end < str.length ? str.substring(start, end) : str;
}
