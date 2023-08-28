import Link from "next/link";

import {
  buildTimetable,
  formatTime,
  formatWeeks,
  getNormalTime,
  hash,
  type Teacher,
  type TimetableCell,
} from "@acme/common";
import { type Course, type CourseTimeWeeks } from "@acme/db";

import { api } from "~/utils/api";
import { Card } from "./Card";

type TimetableProps = {
  yearId: number;
};

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

export default function TimetableView({ yearId }: TimetableProps) {
  const timetable = useTimetable(yearId);

  if (timetable.status === "loading") {
    return <div>Loading...</div>;
  }

  if (timetable.status === "error") {
    return <div>Error: {timetable.error.message}</div>;
  }

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
      />
    ));
  };

  return (
    <Card noPadding className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th></th>
            {weekdays.map((day) => (
              <th
                className="border-grey-100 border-l py-4 font-normal"
                key={day}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timetable.data.map((row, periodIndex) => (
            <tr key={periodIndex}>
              <th className="border-grey-100 border-t px-4 font-normal">
                {formatTime(getNormalTime(periodIndex) ?? 0)} -{" "}
                {formatTime((getNormalTime(periodIndex) ?? 0) + 80)}
              </th>
              {[...new Array<unknown>(5)].map((_, dayIndex) => (
                <td
                  className="border-grey-100  border-l border-t"
                  key={dayIndex}
                >
                  <div className="flex flex-col gap-2 p-2">
                    {renderCell(row[dayIndex])}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const CoursePill = ({
  course,
  weeks,
}: {
  course: Omit<Course, "createdAt" | "room"> & {
    teacher: Teacher;
  };
  weeks: CourseTimeWeeks;
}) => {
  return (
    <Link
      href={`/admin/courses/${course.courseId}`}
      className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-2 text-sm text-white"
      style={{
        backgroundColor: `hsl(${(hash(course.name) % 180) + 180}, 100%, 30%)`,
      }}
    >
      <div className="truncate">
        {course.name}
        {course.isChoosable ? "*" : ""}
      </div>
      <div>{course.courseId}</div>
      <div className="grow">{course.teacher.name}</div>
      {weeks !== "BOTH" && <div>{formatWeeks(weeks)}</div>}
    </Link>
  );
};

export const useTimetable = (yearId: number) => {
  const courses = api.courses.get.useQuery({ yearId });

  if (courses.status === "loading") {
    return { status: "loading" as const };
  }

  if (courses.status === "error") {
    return { status: "error" as const, error: courses.error };
  }

  console.log(courses.data.length);

  return { status: "success" as const, data: buildTimetable(courses.data) };
};
