import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import type { MakeRequest } from "@schnau/external-api";
import { and, eq } from "@schnau/db";
import { db } from "@schnau/db/client";
import {
  _ClassToCourse,
  Class,
  Course,
  Substitution,
  User,
  Year,
} from "@schnau/db/schema";
import {
  findAbbrvName,
  loginIservWithDefaultCredentials,
} from "@schnau/external-api";
import { getNormalTimeIndex } from "@schnau/lib";
import { getSubstitutions } from "@schnau/lib-server";

dayjs.extend(utc);

export const copySubstitutions = async (day: "TODAY" | "TOMORROW") => {
  const { substitutions, date } = await getSubstitutions(
    "IGS Lilienthal",
    day === "TODAY" ? "iServ_SuS_heute" : "iServ_SuS_morgen",
  );

  let makeIservRequest: MakeRequest | null = null;
  const lazyFindAbbrv = async (abbrv: string) => {
    makeIservRequest ??= await loginIservWithDefaultCredentials();
    console.log("Making request for " + abbrv);
    return findAbbrvName(makeIservRequest, abbrv);
  };

  const lazyGetCreateUser = async (abbrv?: string) => {
    if (!abbrv) {
      return undefined;
    }

    const existingUsers = await db
      .select()
      .from(User)
      .where(eq(User.abbrv, abbrv));

    const existingUser = existingUsers[0];
    if (existingUser) {
      console.log("Reusing existing user for " + abbrv);
      return existingUser.id;
    }

    const iservUser = await lazyFindAbbrv(abbrv);

    const [newUser] = await db
      .insert(User)
      .values({
        abbrv,
        name: iservUser?.name ?? abbrv,
        email: iservUser?.email,
        updatedAt: new Date(),
      })
      .returning()
      .execute();

    if (!newUser) {
      throw new Error(`Could not create user for ${abbrv}`);
    }

    return newUser.id;
  };

  const createdCount = 0;
  const updatedCount = 0;

  for (const sub of substitutions) {
    const {
      type: unparsedType,
      subject,
      class: clazz,
      room,
      substitute,
      time,
    } = sub;

    const classes = clazz?.split(", ");
    for (const class_ of classes ?? []) {
      if (class_ === "") {
        continue;
      }

      const yearNumStr = class_.split(".")[0];
      if (!yearNumStr) {
        console.error(`Could not parse year for "${class_}"`);
        process.exit(1);
      }
      const yearNum = parseInt(yearNumStr);
      const identifierInYear = class_.split(".")[1];

      const today = new Date();
      let startYear = today.getFullYear() - yearNum + 5;
      if (today.getMonth() < 8) startYear--;

      const dbYear = await db.query.Year.findFirst({
        where: eq(Year.startYear, startYear),
      });

      if (!dbYear) {
        // console.error(
        //   `Could not find year for ${class_} with startYear ${startYear}`,
        // );
        continue;
      }

      const dbClass = await db.query.Class.findFirst({
        // where: {
        //   yearId: dbYear.id,
        //   identifierInYear,
        // },
        where: and(
          eq(Class.yearId, dbYear.id),
          identifierInYear !== undefined
            ? eq(Class.identifierInYear, identifierInYear)
            : undefined,
        ),
      });

      if (!dbClass) {
        console.error(`Could not find class for ${class_}`);
        process.exit(1);
      }

      // const dbCourse = await db.course.findFirst({
      //   where: {
      //     classes: {
      //       some: {
      //         id: dbClass.id,
      //       },
      //     },
      //     courseId: subject?.toLowerCase(),
      //   },
      //   include: {
      //     teacher: true,
      //   },
      // });
      const [dbCourse] = await db
        .select()
        .from(Course)
        .innerJoin(User, eq(User.id, Course.teacherId))
        .innerJoin(
          _ClassToCourse,
          and(
            eq(_ClassToCourse.course, Course.id),
            eq(_ClassToCourse.class, dbClass.id),
          ),
        )
        .where(
          subject !== undefined
            ? eq(Course.courseId, subject.toLowerCase())
            : undefined,
        )
        .execute();

      if (!dbCourse) {
        console.error(`Could not find course for class ${class_}: ${subject}`);
        continue;
      }

      const typeSchema = z.enum([
        "FREISETZUNG",
        "VERTRETUNG",
        "BETREUUNG",
        "ENTFALL",
        "TROTZ_ABSENZ",
      ]);
      const type = typeSchema.safeParse(
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- We don't want to allow empty strings
        unparsedType?.toUpperCase().replaceAll(" ", "_") || "VERTRETUNG",
      );

      if (!type.success) {
        console.error(`Could not parse type for ${class_}: ${unparsedType}`);
        continue;
      }

      const { start, end } = parseLessonTime(sub);

      if (!start || !end) {
        console.error(`Could not parse time for ${class_}: ${time}`);
        continue;
      }

      const normalTimeIndex = getNormalTimeIndex(start);

      if (normalTimeIndex === -1) {
        console.error(
          `Could not find normalTimeIndex for Class ${class_} with Subject ${dbCourse.Course.name}: ${time}`,
        );
        continue;
      }

      const lessonStart = normalTimeIndex * 2; // TODO: Mobile App currently expects lessonStart to be in hours, not blocks
      const lessonEnd = lessonStart + 1;

      const substituteUser = await lazyGetCreateUser(substitute);

      // const res = await db.substitution.upsert({
      //   where: {
      //     substitutionIdentifier: {
      //       date,
      //       lessonStart,
      //       courseId: dbCourse.id,
      //     },
      //   },
      //   create: {
      //     date,
      //     lessonStart,
      //     lessonEnd,
      //     course: {
      //       connect: {
      //         id: dbCourse.id,
      //       },
      //     },
      //     room: room,
      //     type: type.data,
      //     substitute: substituteUser,
      //   },
      //   update: {
      //     date,
      //     lessonStart,
      //     lessonEnd,
      //     course: {
      //       connect: {
      //         id: dbCourse.id,
      //       },
      //     },
      //     room: room,
      //     type: type.data,
      //     substitute: substituteUser,
      //   },
      // });
      const [res] = await db
        .insert(Substitution)
        .values({
          date,
          lessonStart,
          lessonEnd,
          courseId: dbCourse.Course.id,
          room,
          type: type.data,
          substituteId: substituteUser,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            Substitution.date,
            Substitution.lessonStart,
            Substitution.courseId,
          ],
          set: {
            date,
            lessonStart,
            lessonEnd,
            courseId: dbCourse.Course.id,
            room,
            type: type.data,
            substituteId: substituteUser,
            updatedAt: new Date(),
          },
        })
        .returning()
        .execute();

      if (!res) {
        throw new Error(`Could not create substitution for ${class_}`);
      }

      const isNew = dayjs(res.updatedAt).diff(res.createdAt) < 1000;

      console.log(res, isNew);

      //   if (isNew) {
      //     // const notifiedCount = await notifySubscribers(app, res, dbCourse);

      //     // console.log(
      //     //   `Created substitution ${substitution.date.format("YYYY-MM-DD")} ${
      //     //     substitution.lessonStart
      //     //   } ${substitution.lessonEnd} ${substitution.type} ${
      //     //     substitution.subject
      //     //   } ${class_} and notified ${notifiedCount} subscribers`,
      //     // );
      //     createdCount++;
      //   } else {
      //     updatedCount++;
      //   }
    }
  }

  console.log(
    `${dayjs().format(
      "YYYY-MM-DD HH:mm",
    )}: Finished Day ${dayjs(date).format("DD.MM.YYYY")} (created: ${createdCount}, updated: ${updatedCount})`,
  );
};

function parseLessonTime({ time }: { time?: string }) {
  const [start, end] = time?.split("-") ?? [];

  return {
    start: start ? parseTime(start) : undefined,
    end: end ? parseTime(end) : undefined,
  };
}

function parseTime(time: string) {
  const [hour, minute] = time.split(":").map((s) => parseInt(s));
  if (
    hour === undefined ||
    minute === undefined ||
    isNaN(hour) ||
    isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(`Invalid time given: ${time}`);
  }

  return hour * 60 + minute;
}
