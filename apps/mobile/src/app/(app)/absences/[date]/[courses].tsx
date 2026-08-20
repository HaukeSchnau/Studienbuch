import { useLocalSearchParams } from "expo-router";
import { getAbsenceRouteParams } from "~/infra/routing/params";
import { ExcuseScreen } from "~/features/absences";

export default function ExcuseAbsencePage() {
  const params = useLocalSearchParams<{
    date: string;
    courses: string;
  }>();
  const { date, courseIds } = getAbsenceRouteParams(params);

  if (!date) {
    return null;
  }

  return <ExcuseScreen date={date} courseIds={courseIds} />;
}
