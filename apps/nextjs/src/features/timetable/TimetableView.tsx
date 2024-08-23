import type {
  Course,
  CourseTimeWeeks,
  Timetable,
  TimetableCell,
} from "@stu/lib";
import Link from "next/link";
import {
  formalName,
  formatTime,
  formatWeeks,
  getNormalTime,
  hash,
} from "@stu/lib";
import { z } from "zod";

import { useParsedParams } from "~/infrastructure/hooks/useSafeParams";

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

interface Props {
  timetable: Timetable;
  clickable?: boolean;
}

export const TimetableView = ({ timetable, clickable }: Props) => {
  const renderCell = (cell?: TimetableCell) => {
    if (!cell) return null;

    const uniquieEntries = cell.filter(
      (entry, index, self) =>
        self.findIndex(
          (other) =>
            other.course.courseId === entry.course.courseId &&
            other.weeks === entry.weeks &&
            other.duration === entry.duration,
        ) === index,
    );

    return uniquieEntries.map((entry) => (
      <CoursePill
        key={`${entry.course.courseId}-${entry.weeks}-${entry.duration}`}
        course={entry.course}
        weeks={entry.weeks}
        asLink={clickable}
      />
    ));
  };

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th></th>
          {weekdays.map((day) => (
            <th className="border border-grey-100 py-4 font-normal" key={day}>
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {timetable.map((row, periodIndex) => (
          <tr key={periodIndex}>
            <th className="border border-grey-100 px-4 font-normal">
              {formatTime(getNormalTime(periodIndex) ?? 0)} -{" "}
              {formatTime((getNormalTime(periodIndex) ?? 0) + 80)}
            </th>
            {[...new Array<unknown>(5)].map((_, dayIndex) => (
              <td className="border border-grey-100" key={dayIndex}>
                <div className="flex flex-col gap-2 p-2">
                  {renderCell(row[dayIndex])}
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const CoursePill = ({
  course,
  weeks,
  asLink,
}: {
  course: Course;
  weeks: CourseTimeWeeks;
  asLink?: boolean;
}) => {
  const { school, year } = useParsedParams(
    z.object({
      school: z.string(),
      year: z.string(),
    }),
  );

  const content = (
    <>
      <div className="truncate">
        {course.name}
        {course.isChoosable ? "*" : ""}
      </div>
      <div>{course.courseId}</div>
      <div className="grow">{formalName(course.teacher)}</div>
      {weeks !== "BOTH" && <div>{formatWeeks(weeks)}</div>}
    </>
  );

  const backgroundColor = `hsl(${(hash(course.name) % 180) + 180}, 100%, 30%)`;

  if (asLink) {
    return (
      <Link
        href={`/admin/schools/${school}/years/${year}/courses/${course.courseId}`}
        className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-white"
        style={{
          backgroundColor,
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-white"
      style={{
        backgroundColor,
      }}
    >
      {content}
    </div>
  );
};
