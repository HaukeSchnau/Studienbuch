import { useLocalSearchParams } from "expo-router";
import { CourseScreen } from "~/features/courses/screens/course-screen";

export default function Course() {
  const { course: courseId } = useLocalSearchParams<{ course: string }>();

  return <CourseScreen courseId={courseId} />;
}
