import fs from "fs/promises";
import Papa from "papaparse";
import { z } from "zod";

import type { CourseTimeWeeks, ProtoCourseWithTimes } from "@schnau/lib";
import { isNormalTime, parseTime } from "@schnau/lib";

import { parseTimetableCell } from "./parseTimetableCell";

import "@total-typescript/ts-reset";

export const parseScheduleCsv = async (
  filepath: string,
  areAllCoursesChoosable: boolean,
): Promise<ProtoCourseWithTimes[]> => {
  const fileContents = await fs.readFile(filepath, "utf8");
  const { data: rawRows } = Papa.parse(fileContents, { header: true });

  const rowSchema = z.object({
    "": z.string(),
    Montag: z.string(),
    Dienstag: z.string(),
    Mittwoch: z.string(),
    Donnerstag: z.string(),
    Freitag: z.string(),
  });

  const rows = rawRows
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
      const endMinutes = parseTime(end ?? "40") + 40;
      const cols = [Montag, Dienstag, Mittwoch, Donnerstag, Freitag].map(
        parseTimetableCell,
      );

      return {
        startMinutes,
        endMinutes,
        cols,
      };
    });

  const courses: ProtoCourseWithTimes[] = [];
  for (const [rowNum, row] of rows.entries()) {
    for (const [dayNum, coursesForDay] of row.cols.entries()) {
      const cellBelow = rows[rowNum + 1]?.cols[dayNum];

      const normalTime = isNormalTime(row.startMinutes);
      let weeks: CourseTimeWeeks = "BOTH";
      let startMinutes = row.startMinutes;
      let endMinutes = row.endMinutes;

      if (!normalTime && coursesForDay.length > 0) {
        weeks = "EVEN";
        startMinutes -= 40;
        endMinutes -= 40;
      }

      if (
        normalTime &&
        coursesForDay.length > 0 &&
        cellBelow &&
        cellBelow.length > 0
      ) {
        weeks = "ODD";
      }

      for (const course of coursesForDay) {
        const existingCourse = courses.find(
          (candidate) =>
            candidate.normalizedCourseId === course.normalizedCourseId,
        );

        const time = {
          weekday: dayNum + 1,
          start: startMinutes,
          duration: endMinutes - startMinutes,
          weeks,
        };

        if (existingCourse) {
          existingCourse.times.push(time);
        } else {
          courses.push({
            ...course,
            isChoosable: course.isChoosable || areAllCoursesChoosable,
            times: [time],
          });
        }
      }
    }
  }

  return courses;
};
