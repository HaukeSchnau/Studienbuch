import type { Course, YearIdentifier } from "@stu/lib";
import { buildTimetable } from "@stu/lib";

import { Card } from "~/components/layout/Card";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { TimetableView } from "./TimetableView";

interface TimetableProps {
  year: YearIdentifier;
}

export const TimetableManager = ({ year }: TimetableProps) => {
  const timetable = useTimetable(year);

  if (timetable.status === "loading") {
    return <LoadingIndicator />;
  }

  if (timetable.status === "error") {
    return <div>Error: {timetable.error.message}</div>;
  }

  return (
    <Card noPadding className="overflow-x-auto">
      <TimetableView timetable={timetable.data} clickable />
    </Card>
  );
};

export const useTimetable = (year: YearIdentifier) => {
  // const courses = api.courses.listChoices.useQuery({

  //  });
  const courses: {
    data: Course[];
    status: string;
    error: {
      message: string;
    };
  } = {
    data: [],
    status: "success",
    error: { message: "Error message" },
  }; // TODO: Replace with actual data

  if (courses.status === "pending") {
    return { status: "loading" as const };
  }

  if (courses.status === "error") {
    return { status: "error" as const, error: courses.error };
  }

  return {
    status: "success" as const,
    data: buildTimetable(courses.data),
  };
};
