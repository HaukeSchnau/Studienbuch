import { ActivityIndicator } from "react-native";
import { Stack } from "expo-router";

import type { GradeType } from "@stu/lib";

import { api } from "~/utils/api";
import { ConfirmMasterGradeParent } from "./master/confirm-master-grade-parent";
import { ConfirmMasterGradeTeacher } from "./master/confirm-master-grade-teacher";

interface Props {
  date: Date;
  courseId: string;
  type: GradeType;
}

export const GradePage = ({ date, courseId, type }: Props) => {
  const gradeQuery = api.students.grades.getOne.useQuery({
    date,
    course: courseId,
    type,
  });

  if (!gradeQuery.data) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Gesamtnote bestätigen",
            headerTintColor: "#FFFFFF",
          }}
        />
        <ActivityIndicator />
      </>
    );
  }

  const grade = gradeQuery.data;

  if (type === "MASTER") {
    if (!grade.teacherSignature) {
      return <ConfirmMasterGradeTeacher grade={grade} />;
    }

    if (!grade.parentSignature) {
      return <ConfirmMasterGradeParent grade={grade} />;
    }
  }

  return <></>;
};
