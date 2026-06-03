import { View } from "react-native";
import { Card } from "~/components/card";
import { Divider } from "~/components/divider";
import { Text } from "~/components/text";
import { useMockApp } from "~/mock-app/provider";
import { getGradesOverviewModel } from "./grades-overview-model";
import { MasterGradeRow } from "./master-grade-row";
import { OralGradesRow } from "./oral-grades-row";
import { WrittenGradesRow } from "./written-grades-row";

export const GradesOverviewCard = ({ courseId }: { courseId: string }) => {
  const { getCourseGrades } = useMockApp();
  const grades = getCourseGrades(courseId);
  const { masterGrades, oralGrades, writtenGrades } = getGradesOverviewModel(grades);

  return (
    <Card padding="sm">
      <Text variant="heading">Deine Noten</Text>
      <View className="h-4" />
      <MasterGradeRow masterGrades={masterGrades} courseId={courseId} />
      <View className="h-4" />
      <Divider />
      <View className="h-4" />
      <OralGradesRow oralGrades={oralGrades} courseId={courseId} />
      <View className="h-4" />
      <Divider />
      <View className="h-4" />
      <WrittenGradesRow writtenGrades={writtenGrades} courseId={courseId} />
    </Card>
  );
};
