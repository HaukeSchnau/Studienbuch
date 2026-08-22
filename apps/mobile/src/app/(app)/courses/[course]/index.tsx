import { useLocalSearchParams } from "expo-router";
import { getCourseRouteParams } from "~/infra/routing/params";
import { CourseScreen } from "~/features/courses/screens/course-screen";

export default function Course() {
  const { course: courseId } = useLocalSearchParams<{ course: string }>();
  const routeParams = getCourseRouteParams({ course: courseId });

  if (!routeParams.courseId) {
    return null;
  }

  return <CourseScreen courseId={routeParams.courseId} />;
}
