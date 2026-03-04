import crypto from "node:crypto";
import { Database, inArray } from "@stu/db";
import { Classes } from "@stu/db/schema";
import { BetterMap, type SubjectId, subjectNameMap } from "@stu/lib";
import { getWeek } from "date-fns";
import { Effect } from "effect";

interface DiscoveredCourseTime {
  duration: number;
  start: number;
  weekday: number;
  weeks: Record<"EVEN" | "ODD", number>;
}

export interface DiscoveredTeacher {
  id: string;
  salutation: "Herr" | "Frau" | null;
  firstName: string;
  lastName: string;
  abbrv: string | null;
  email: string | null;
}

export interface DiscoveredCourse {
  name: SubjectId;
  courseId: string;
  courseTimes: DiscoveredCourseTime[];
  teachers: DiscoveredTeacher[];
  class: {
    identifierInYear: string;
    startYear: number;
  };
}

export const recurringCourses = Effect.gen(function* () {
  const db = yield* Effect.service(Database);
  const classes = yield* db
    .execute((db) =>
      db.query.Classes.findMany({
        where: inArray(Classes.startYear, [2017, 2018, 2019]),
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
      }),
    )
    .pipe(
      Effect.map((classes) =>
        classes.map((c) => ({
          ...c,
          courses: c.courses.flatMap((c) => ({
            ...c.course,
            teachers: c.course.teachers.map((t) => t.teacher),
          })),
        })),
      ),
    );

  const discoveredCourses: DiscoveredCourse[] = [];
  for (const clazz of classes) {
    for (const course of clazz.courses) {
      // key is hash of start, duration, weekday
      const courseTimes = new BetterMap<string, DiscoveredCourseTime>();
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
          course.name.toLowerCase() === subjectNameMap[course.subject].toLowerCase() ? course.subject : course.name,
        courseTimes: Array.from(courseTimes.values()),
        teachers: course.teachers,
        class: {
          identifierInYear: clazz.identifierInYear,
          startYear: clazz.startYear,
        },
      });
    }
  }
  return discoveredCourses;
});
