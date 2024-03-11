import { buildTimetable } from "@schnau/lib/src/timetable";

import { Card } from "~/components/layout/Card";
import { api } from "~/infrastructure/trpc/react";
import { TimetableView } from "./TimetableView";

interface TimetableProps {
  yearId: number;
}

export const TimetableManager = ({ yearId }: TimetableProps) => {
  const timetable = useTimetable(yearId);

  if (timetable.status === "loading") {
    return <div>Loading...</div>;
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

export const useTimetable = (yearId: number) => {
  const courses = api.courses.get.useQuery({ yearId });

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
