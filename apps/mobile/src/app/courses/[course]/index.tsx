import { useLocalSearchParams } from "expo-router";
import { CoursePage } from "~/features/courses/course.page";

export default function Course() {
  const { course: courseId } = useLocalSearchParams<{ course: string }>();

  return <CoursePage courseId={courseId} />;
}
