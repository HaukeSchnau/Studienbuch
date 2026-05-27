import { useLocalSearchParams } from "expo-router";
import { ExcusePage } from "~/features/absences/excuse.page";

export default function ExcuseAbsencePage() {
  const { courses: coursesStr, date: dateStr } = useLocalSearchParams<{
    date: string;
    courses: string;
  }>();

  return (
    <ExcusePage date={new Date(Number.parseInt(dateStr, 10))} courseIds={coursesStr.split(";")} />
  );
}
