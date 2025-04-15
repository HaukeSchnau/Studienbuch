import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod";

import { db } from "@stu/db/client";
import type { SchoolId, SubstitutionType } from "@stu/lib";
import { SUBSTITUTION_TYPES } from "@stu/lib";
import type { KadmosSubstitution } from "@stu/lib-server";
import { getSubstitutions } from "@stu/lib-server";

dayjs.extend(utc);

interface ProcessedSubstitution {
  startTimeOfDay: number;
  type: SubstitutionType;
  classes: {
    currentYear: number;
    identifierInYear: string;
  }[];
  substitute: string | undefined;
  room: string | undefined;
  subject: string | undefined;
}

const preprocess = (substitutions: KadmosSubstitution[]) => {
  const processedSubstitutions: ProcessedSubstitution[] = [];

  for (const sub of substitutions) {
    const {
      type: unparsedType,
      subject,
      class: classesJoined,
      room,
      substitute,
      time,
    } = sub;

    const classes = classesJoined?.split(", ");

    const processedClasses: ProcessedSubstitution["classes"] = [];
    for (const clazz of classes ?? []) {
      if (clazz === "") {
        continue;
      }

      const [yearNumStr, identifierInYear] = clazz.split(".");
      if (!yearNumStr) {
        console.error(`Could not parse year for "${clazz}"`);
        process.exit(1);
      }

      const yearNum = parseInt(yearNumStr);

      processedClasses.push({
        currentYear: yearNum,
        identifierInYear: identifierInYear ?? "",
      });
    }

    const typeSchema = z.enum(SUBSTITUTION_TYPES);
    const type = typeSchema.safeParse(
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- We don't want to allow empty strings
      unparsedType?.toUpperCase().replaceAll(" ", "_") || "VERTRETUNG",
    );

    if (!type.success) {
      console.error(`Could not parse type: ${unparsedType}`);
      continue;
    }

    const { start, end } = parseLessonTime(sub);

    if (!start || !end) {
      console.error(`Could not parse type: ${time}`);
      continue;
    }

    processedSubstitutions.push({
      startTimeOfDay: start,
      type: type.data,
      classes: processedClasses,
      substitute,
      room,
      subject,
    });
  }

  return processedSubstitutions;
};

export const copySubstitutions = async (
  school: SchoolId,
  day: "TODAY" | "TOMORROW",
) => {
  const { substitutions, date } = await getSubstitutions(
    "IGS Lilienthal",
    day === "TODAY" ? "iServ_SuS_heute" : "iServ_SuS_morgen",
  );

  if (date === null) {
    return;
  }

  // const iservClient = createLazyIservClient();

  const processedSubstitutions = preprocess(substitutions);
  for (const sub of processedSubstitutions) {
    // const today = new Date();
    // const startYear = convertCurrentYearToStartYear(
    // const start = add(date, { minutes: sub.startTimeOfDay });

    // const dbClass = await db.query.Classes.findFirst({
    //   where: and(
    //     eq(Classes.school, school),
    //     eq(Classes.startYear, startYear),
    //     identifierInYear !== undefined
    //       ? eq(Classes.identifierInYear, identifierInYear)
    //       : undefined,
    //   ),
    // });

    // const [course] = await db
    //   .select()
    //   .from(Courses)
    //   .innerJoin(Users, eq(User.id, Course.teacherId))
    //   .innerJoin(
    //     _ClassToCourse,
    //     and(
    //       eq(_ClassToCourse.course, Course.id),
    //       eq(_ClassToCourse.class, dbClass.id),
    //     ),
    //   )
    //   .where(
    //     subject !== undefined
    //       ? eq(Course.courseId, subject.toLowerCase())
    //       : undefined,
    //   )
    //   .execute();

    // if (!dbCourse) {
    //   console.error(`Could not find course for class ${class_}: ${subject}`);
    //   continue;
    // }

    const courses = await db.query.Courses.findMany({
      with: {
        classes: {
          with: {
            class: true,
          },
          // where: and(
          //   eq(Classes.school, school),
          //   eq(Classes.startYear, sub.classes[0].currentYear),
          //   eq(Classes.identifierInYear, sub.classes[0].identifierInYear),
          // ),
        },
      },
    });

    console.log(sub);
    console.log(courses);

    // const substituteUser = await lazyGetCreateUser(sub.substitute);

    // const [res] = await db
    //   .insert(Substitutions)
    //   .values({
    //     start,
    //     course: courseId,
    //     type: sub.type,
    //     substitute: substituteUser,
    //     updatedAt: new Date(),
    //   })
    //   .onConflictDoUpdate({
    //     target: [
    //       Substitution.date,
    //       Substitution.lessonStart,
    //       Substitution.courseId,
    //     ],
    //     set: {
    //       date,
    //       lessonStart,
    //       lessonEnd,
    //       courseId: dbCourse.Course.id,
    //       room,
    //       type: type.data,
    //       substituteId: substituteUser,
    //       updatedAt: new Date(),
    //     },
    //   })
    //   .returning()
    //   .execute();

    // if (!res) {
    //   throw new Error(`Could not create substitution for ${class_}`);
    // }

    // const isNew = dayjs(res.updatedAt).diff(res.createdAt) < 1000;

    // console.log(res, isNew);

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

  // console.log(
  //   `${dayjs().format(
  //     "YYYY-MM-DD HH:mm",
  //   )}: Finished Day ${dayjs(date).format("DD.MM.YYYY")} (created: ${createdCount}, updated: ${updatedCount})`,
  // );
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
