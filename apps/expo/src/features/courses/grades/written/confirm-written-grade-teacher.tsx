import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "date-fns";

import { formalName, formatGrade } from "@stu/lib";

import type { ConfirmedGrade, Grade } from "../grade.type";
import {
  ConfirmPageContent,
  ViewConfirmPageContent,
} from "~/components/confirm-page-content";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { useIngest } from "~/utils/events/ingest";

export const ConfirmWrittenGradeTeacher = ({ grade }: { grade: Grade }) => {
  const { user } = useRequiredAuthenticatedSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const confirmMutation = useIngest("grades.teacherApproved", {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["grades"],
      });
      router.back();
    },
  });

  const handleConfirm = (signature: string) =>
    confirmMutation.mutate({
      course: grade.course.id,
      date: grade.date,
      signature,
      type: "WRITTEN",
    });

  const [teacher] = grade.course.teachers;
  const { date, result } = grade;

  if (!teacher) {
    return <TempError />;
  }

  return (
    <View className="p-8">
      <Stack.Screen
        options={{
          title: "schriftliche Note bestätigen (Lehrer)",
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
        <Text weight="bold">{formatDate(date, "dd.MM.yyyy")}</Text> die Klausur
        in <Text weight="bold">{grade.course.longName}</Text> mit der Note{" "}
        <Text weight="bold">{formatGrade(result)}</Text> geschrieben hat.
      </ConfirmPageContent>
    </View>
  );
};

export const WrittenGradeTeacherConfirmationView = ({
  grade,
}: {
  grade: ConfirmedGrade;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const { date, result } = grade;

  const [teacher] = grade.course.teachers;

  if (!teacher) {
    return <TempError />;
  }

  return (
    <ViewConfirmPageContent
      signatureLabel={`Unterschrift von ${formalName(teacher)}`}
      signatureSvg={grade.teacherSignature}
    >
      Ich, {formalName(teacher)} bestätige, dass der/die Schüler:in{" "}
      <Text weight="bold">{user.name}</Text> am{" "}
      <Text weight="bold">{formatDate(date, "dd.MM.yyyy")}</Text> die Klausur in{" "}
      <Text weight="bold">{grade.course.longName}</Text> mit der Note{" "}
      <Text weight="bold">{formatGrade(result)}</Text> geschrieben hat.
    </ViewConfirmPageContent>
  );
};
