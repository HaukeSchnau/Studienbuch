import { useLocalSearchParams } from "expo-router";
import { GradeScreen } from "~/features/grades/screens/grade-screen";
import type { GradeType } from "@stu/core";

export default function GradePageEntry() {
  const params = useLocalSearchParams<{
    course: string;
    date: string;
    type: GradeType;
  }>();

  return (
    <GradeScreen
      courseId={params.course}
      date={new Date(Number.parseInt(params.date, 10))}
      type={params.type}
    />
  );
}
