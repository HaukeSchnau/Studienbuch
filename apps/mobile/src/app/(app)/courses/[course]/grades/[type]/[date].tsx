import { useLocalSearchParams } from "expo-router";
import { getGradeRouteParams } from "~/infra/routing/params";
import { GradeScreen } from "~/features/courses/grades/screens/grade-screen";

export default function GradePageEntry() {
  const params = useLocalSearchParams<{
    course: string;
    date: string;
    type: string;
  }>();
  const routeParams = getGradeRouteParams(params);

  if (!routeParams.courseId || !routeParams.date || !routeParams.type) {
    return null;
  }

  return (
    <GradeScreen courseId={routeParams.courseId} date={routeParams.date} type={routeParams.type} />
  );
}
