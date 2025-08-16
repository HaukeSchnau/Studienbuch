import { useLocalSearchParams } from "expo-router";

import { ExcusePage } from "~/features/absences/excuse/excuse.page";

export default function ExcuseAbsencePage() {
  const { courses: coursesStr, date: dateStr } = useLocalSearchParams<{
    date: string;
    courses: string;
  }>();
  const date = new Date(Number.parseInt(dateStr, 10));
  const courses = coursesStr.split(";");

  return <ExcusePage date={date} courseIds={courses} />;
}
