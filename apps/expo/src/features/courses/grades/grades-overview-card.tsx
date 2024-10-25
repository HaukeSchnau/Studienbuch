import React from "react";
import { ActivityIndicator, View } from "react-native";

import type { Grade } from "@stu/lib";

import { Card } from "~/components/card";
import { Divider } from "~/components/divider";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { MasterGradeRow } from "./master/master-grade-row";
import { OralGradesRow } from "./oral/oral-grades-row";
import { WrittenGradesRow } from "./written/written-grades-row";
import { TempError } from "~/components/temp-error";

export const GradesOverviewCard = ({ courseId }: { courseId: string }) => {
  const grades = api.students.grades.list.useQuery(
    { courseId },
    {
      select: (grades) => {
        const oral: Grade[] = [];
        const written: Grade[] = [];
        const master: Grade[] = [];

        for (const grade of grades) {
          if (grade.type === "ORAL") {
            oral.push(grade);
          } else if (grade.type === "WRITTEN") {
            written.push(grade);
          } else {
            master.push(grade);
          }
        }

        return {
          oral,
          written,
          master,
        };
      },
    },
  );

  if (grades.isPending) {
    return <ActivityIndicator />;
  }

  if (grades.isError) {
    return <TempError error={grades.error.message} />;
  }

  return (
    <Card>
      <Text variant="heading">Deine Noten</Text>
      <View className="h-4" />
      <MasterGradeRow masterGrades={grades.data.master} courseId={courseId} />
      <View className="h-4" />
      <Divider />
      <View className="h-4" />
      <OralGradesRow oralGrades={grades.data.oral} courseId={courseId} />
      <View className="h-4" />
      <Divider />
      <View className="h-4" />
      <WrittenGradesRow
        writtenGrades={grades.data.written}
        courseId={courseId}
      />
    </Card>
  );
};
