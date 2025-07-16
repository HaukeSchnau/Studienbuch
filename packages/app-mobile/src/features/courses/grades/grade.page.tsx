import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import type { GradeType } from "@stu/lib";

import { ConfirmMasterGradeParent, MasterGradeParentConfirmationView } from "./master/confirm-master-grade-parent";
import { ConfirmMasterGradeTeacher, MasterGradeTeacherConfirmationView } from "./master/confirm-master-grade-teacher";
import { ConfirmOralGradeParent, OralGradeParentConfirmationView } from "./oral/confirm-oral-grade-parent";
import { ConfirmOralGradeTeacher, OralGradeTeacherConfirmationView } from "./oral/confirm-oral-grade-teacher";
import { getGrade } from "./queries/get-grade";
import { ConfirmWrittenGradeParent } from "./written/confirm-written-grade-parent";
import { ConfirmWrittenGradeTeacher } from "./written/confirm-written-grade-teacher";

interface Props {
  date: Date;
  courseId: string;
  type: GradeType;
}

export const GradePage = ({ date, courseId, type }: Props) => {
  const gradeQuery = useQuery(getGrade({ date, courseId, type }));

  if (!gradeQuery.data) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Note",
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

    const confirmedGrade = {
      ...grade,
      parentSignature: grade.parentSignature,
      teacherSignature: grade.teacherSignature,
    };

    return (
      <View className="p-8">
        <Stack.Screen
          options={{
            title: "Gesamtnote",
          }}
        />
        <MasterGradeTeacherConfirmationView grade={confirmedGrade} />
        <View className="h-16" />
        <MasterGradeParentConfirmationView grade={confirmedGrade} />
      </View>
    );
  }

  if (type === "ORAL") {
    if (!grade.teacherSignature) {
      return <ConfirmOralGradeTeacher grade={grade} />;
    }

    if (!grade.parentSignature) {
      return <ConfirmOralGradeParent grade={grade} />;
    }

    const confirmedGrade = {
      ...grade,
      parentSignature: grade.parentSignature,
      teacherSignature: grade.teacherSignature,
    };

    return (
      <View className="p-8">
        <Stack.Screen
          options={{
            title: "Mündliche Note",
          }}
        />
        <OralGradeTeacherConfirmationView grade={confirmedGrade} />
        <View className="h-16" />
        <OralGradeParentConfirmationView grade={confirmedGrade} />
      </View>
    );
  }

  if (!grade.teacherSignature) {
    return <ConfirmWrittenGradeTeacher grade={grade} />;
  }

  if (!grade.parentSignature) {
    return <ConfirmWrittenGradeParent grade={grade} />;
  }

  const confirmedGrade = {
    ...grade,
    parentSignature: grade.parentSignature,
    teacherSignature: grade.teacherSignature,
  };

  return (
    <View className="p-8">
      <Stack.Screen
        options={{
          title: "Schriftliche Note",
        }}
      />
      <MasterGradeTeacherConfirmationView grade={confirmedGrade} />
      <View className="h-16" />
      <MasterGradeParentConfirmationView grade={confirmedGrade} />
    </View>
  );
};
