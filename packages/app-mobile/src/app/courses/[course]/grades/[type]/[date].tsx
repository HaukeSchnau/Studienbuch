import type { GradeType } from "@stu/lib";
import { useLocalSearchParams } from "expo-router";

import { GradePage } from "~/features/courses/grades/grade.page";

export default function GradePageEntry() {
  const {
    course,
    date: dateStr,
    type,
  } = useLocalSearchParams<{
    course: string;
    date: string;
    type: GradeType;
  }>();
  const date = new Date(Number.parseInt(dateStr));

  return <GradePage date={date} courseId={course} type={type} />;
}
