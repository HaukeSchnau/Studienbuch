import { inArray } from "@stu/db";
import { db as mainDb } from "@stu/db/client";
import { Classes } from "@stu/db/schema";
import type { Course, CourseTime } from "@stu/legacy-import";
import { BetterMap, subjectNameMap } from "@stu/lib";
import crypto from "node:crypto";
import { getWeek } from "date-fns";

export const extractCourses = async () => {
  const discoveredCourses: Course[] = [];

  const classes = await mainDb.query.Classes.findMany({
    where: inArray(Classes.startYear, [2016, 2017, 2018]),
    with: {
      courses: {
        columns: {
          course: false,
        },
        with: {
          course: {
            with: {
              timetableEntries: true,
              teachers: {
                columns: {
                  teacher: false,
                },
                with: {
                  teacher: true,
                },
              },
            },
          },
        },
      },
    },
  }).then((classes) =>
    classes.map((c) => ({
      ...c,
      courses: c.courses.flatMap((c) => ({
        ...c.course,
        teachers: c.course.teachers.map((t) => t.teacher),
      })),
    })),
  );

  for (const clazz of classes) {
    for (const course of clazz.courses) {
      // key is hash of start, duration, weekday
      const courseTimes = new BetterMap<
        string,
        Omit<CourseTime, "weeks"> & {
          weeks: Record<"EVEN" | "ODD", number>; // week -> count
        }
      >();
      for (const entry of course.timetableEntries) {
        const calendarWeek = getWeek(entry.start, { weekStartsOn: 1 });
        const week: "EVEN" | "ODD" = calendarWeek % 2 === 0 ? "EVEN" : "ODD";
        const weekday = entry.start.getDay();
        const start = entry.start.getHours() * 60 + entry.start.getMinutes();
        const key = crypto
          .createHash("sha256")
          .update(start.toString())
          .update(entry.duration.toString())
          .update(weekday.toString())
          .digest("hex");

        const courseTime = courseTimes.getWithDefault(key, {
          duration: entry.duration,
          start: start,
          weekday: weekday,
          weeks: {
            EVEN: 0,
            ODD: 0,
          },
        });
        courseTime.weeks[week]++;
      }

      discoveredCourses.push({
        name: course.subject,
        courseId:
          course.name.toLowerCase() ===
          subjectNameMap[course.subject].toLowerCase()
            ? course.subject
            : course.name,
        courseTimes: [
          ...courseTimes.map((c) => {
            const weeks = (() => {
              if (c.weeks.EVEN === 0 && c.weeks.ODD === 0) {
                throw new Error("Course is not in any weeks");
              }

              if (c.weeks.EVEN <= 1) {
                return "ODD" as const;
              }
              if (c.weeks.ODD <= 1) {
                return "EVEN" as const;
              }
              return "BOTH" as const;
            })();

            return {
              ...c,
              weeks,
              weeksCount: c.weeks,
            };
          }),
        ],
        teachers: course.teachers,
        class: {
          identifierInYear: clazz.identifierInYear,
          startYear: clazz.startYear,
        },
      });
    }
  }

  return discoveredCourses;
};
