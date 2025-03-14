import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import type { Grade } from "@stu/lib";

import { Card } from "~/components/card";
import { Divider } from "~/components/divider";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { MasterGradeRow } from "./master/master-grade-row";
import { OralGradesRow } from "./oral/oral-grades-row";
import { listGrades } from "./queries/list-grades";
import { WrittenGradesRow } from "./written/written-grades-row";

export const GradesOverviewCard = ({ courseId }: { courseId: string }) => {
  const grades = useQuery({
    ...listGrades({ courseId }),
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
  });

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
