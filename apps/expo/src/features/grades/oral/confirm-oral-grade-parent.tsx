import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { formatDate } from "date-fns";

import { formatGrade } from "@stu/lib";

import type { Grade } from "../grade.type";
import { ConfirmPageContent } from "~/components/confirm-page-content";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { useRequiredAuthenticatedSession } from "~/utils/auth";

export const ConfirmOralGradeParent = ({ grade }: { grade: Grade }) => {
  const { user } = useRequiredAuthenticatedSession();
  const utils = api.useUtils();
  const router = useRouter();
  const confirmMutation = api.students.grades.confirmParent.useMutation({
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
      type: "ORAL",
    });

  const { date, result } = grade;

  return (
    <View className="p-8">
      <Stack.Screen
        options={{
          title: "mündliche Note bestätigen (Eltern)",
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
        <Text weight="bold">{formatDate(date, "dd.MM.yyyy")}</Text> die
        mündliche Note <Text weight="bold">{formatGrade(result)}</Text> in{" "}
        <Text weight="bold">{grade.course.longName}</Text> hat.
      </ConfirmPageContent>
    </View>
  );
};
