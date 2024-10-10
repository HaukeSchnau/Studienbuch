import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { formatDate } from "date-fns";

import { formalName, formatGrade } from "@stu/lib";

import type { ConfirmedGrade, Grade } from "../grade.type";
import {
  ConfirmPageContent,
  ViewConfirmPageContent,
} from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export const ConfirmMasterGradeTeacher = ({ grade }: { grade: Grade }) => {
  const { user } = useRequiredAuthenticatedSession();
  const utils = api.useUtils();
  const router = useRouter();
  const confirmMutation = api.students.grades.confirmTeacher.useMutation({
    onSuccess: async () => {
      await utils.students.grades.invalidate();
      router.back();
    },
  });

  const handleConfirm = (signature: string) =>
    confirmMutation.mutate({
      course: grade.course.id,
      date: grade.date,
      signature,
      type: "MASTER",
    });

  const [teacher] = grade.course.teachers;
  const { date, result } = grade;

  if (!teacher) {
    return null;
  }

  return (
    <View className="p-8">
      <Stack.Screen
        options={{
          title: "Gesamtnote bestätigen (Lehrer)",
        }}
      />

      <ConfirmPageContent
        heading="Bitte lasse deinen Lehrer hier unterschreiben"
        onConfirm={handleConfirm}
        confirmLabel="Bestätigen"
        signatureLabel={`Unterschrift von ${formalName(teacher)}`}
      >
        Ich, {formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
        <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{formatDate(date, "dd.MM.yyyy")}</Text> die
        Gesamtnote <Text weight="bold">{formatGrade(result)}</Text> in{" "}
        <Text weight="bold">{grade.course.longName}</Text> hat.
      </ConfirmPageContent>
    </View>
  );
};

export const MasterGradeTeacherConfirmationView = ({
  grade,
}: {
  grade: ConfirmedGrade;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const { date, result } = grade;

  const [teacher] = grade.course.teachers;

  if (!teacher) {
    return null;
  }

  return (
    <ViewConfirmPageContent
      signatureLabel={`Unterschrift von ${formalName(teacher)}`}
      signatureSvg={grade.teacherSignature}
    >
      Ich, {formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
      <Text weight="bold">{user.name}</Text> am{" "}
      <Text weight="bold">{formatDate(date, "dd.MM.yyyy")}</Text> die Gesamtnote{" "}
      <Text weight="bold">{formatGrade(result)}</Text> in{" "}
      <Text weight="bold">{grade.course.longName}</Text> hat.
    </ViewConfirmPageContent>
  );
};
