import { useLocalSearchParams } from "expo-router";
import { GradePage } from "~/features/courses/grades/grade.page";
import type { GradeType } from "~/mock-app/domain";

export default function GradePageEntry() {
  const params = useLocalSearchParams<{
    course: string;
    date: string;
    type: GradeType;
  }>();

  return (
    <GradePage
      courseId={params.course}
      date={new Date(Number.parseInt(params.date, 10))}
      type={params.type}
    />
  );
}
