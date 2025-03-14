import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "date-fns";

import { formatGrade } from "@stu/lib";

import type { ConfirmedGrade, Grade } from "../grade.type";
import {
  ConfirmPageContent,
  ViewConfirmPageContent,
} from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { useIngest } from "~/utils/ingest";

export const ConfirmWrittenGradeParent = ({ grade }: { grade: Grade }) => {
  const { user } = useRequiredAuthenticatedSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const confirmMutation = useIngest("grades.parentApproved", {
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

  const { date, result } = grade;

  return (
    <View className="p-8">
      <Stack.Screen
        options={{
          title: "schriftliche Note bestätigen (Eltern)",
        }}
      />

      <ConfirmPageContent
        heading="Bitte lasse deine Eltern hier unterschreiben"
        onConfirm={handleConfirm}
        confirmLabel="Bestätigen"
        signatureLabel="Unterschrift eines Erziehungsberechtigten"
      >
        Ich habe zur Kenntnis genommen, dass mein Kind{" "}
        <Text weight="bold">{user.name}</Text> am{" "}
        <Text weight="bold">{formatDate(date, "dd.MM.yyyy")}</Text> die Klausur
        in <Text weight="bold">{grade.course.longName}</Text> mit der Note{" "}
        <Text weight="bold">{formatGrade(result)}</Text> geschrieben hat.
      </ConfirmPageContent>
    </View>
  );
};

export const WrittenGradeParentConfirmationView = ({
  grade,
}: {
  grade: ConfirmedGrade;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const { date, result } = grade;

  return (
    <ViewConfirmPageContent
      signatureLabel="Unterschrift eines Erziehungsberechtigten"
      signatureSvg={grade.parentSignature}
    >
      Ich habe zur Kenntnis genommen, dass mein Kind{" "}
      <Text weight="bold">{user.name}</Text> am{" "}
      <Text weight="bold">{formatDate(date, "dd.MM.yyyy")}</Text> die Klausur in{" "}
      <Text weight="bold">{grade.course.longName}</Text> mit der Note{" "}
      <Text weight="bold">{formatGrade(result)}</Text> geschrieben hat.
    </ViewConfirmPageContent>
  );
};
