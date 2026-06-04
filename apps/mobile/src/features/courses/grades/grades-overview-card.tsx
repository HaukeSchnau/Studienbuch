import { View } from "react-native";
import { Card } from "~/components/ui/card";
import { Divider } from "~/components/ui/divider";
import { Text } from "~/components/ui/text";
import { useGrades } from "~/data/hooks";
import { getGradesOverviewModel } from "./grades-overview-model";
import { MasterGradeRow } from "./master-grade-row";
import { OralGradesRow } from "./oral-grades-row";
import { WrittenGradesRow } from "./written-grades-row";

export const GradesOverviewCard = ({ courseId }: { courseId: string }) => {
  const { getCourseGrades } = useGrades();
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
