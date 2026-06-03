import { useLocalSearchParams } from "expo-router";
import { getCourseRouteParams } from "~/app-shell/routing/params";
import { CourseScreen } from "~/features/courses";

export default function Course() {
  const { course: courseId } = useLocalSearchParams<{ course: string }>();
  const routeParams = getCourseRouteParams({ course: courseId });

  if (!routeParams.courseId) {
    return null;
  }

  return <CourseScreen courseId={routeParams.courseId} />;
}
