import { useLocalSearchParams } from "expo-router";
import { ExcuseScreen } from "~/features/absences/screens/excuse-screen";

export default function ExcuseAbsencePage() {
  const { courses: coursesStr, date: dateStr } = useLocalSearchParams<{
    date: string;
    courses: string;
  }>();

  return (
    <ExcuseScreen date={new Date(Number.parseInt(dateStr, 10))} courseIds={coursesStr.split(";")} />
  );
}
