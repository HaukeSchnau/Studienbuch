import type { Grade } from "@stu/lib";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "~/components/button";
import { Divider } from "~/components/divider";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { useIngest } from "~/utils/events/ingest";
import { GradeCard } from "../grade-card";

export const EditMasterGrade = ({
  courseId,
  onClose,
  mostRecentConfirmedMasterGrade,
}: {
  courseId: string;
  onClose: () => void;
  mostRecentConfirmedMasterGrade: Grade | null;
}) => {
  const { userId } = useRequiredAuthenticatedSession();
  const queryClient = useQueryClient();
  const upsertMutation = useIngest("grades.currentGradeSet", {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["grades"],
      });
      onClose();
    },
  });

  const restoreMutation = useIngest("grades.latestRestored", {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["grades"],
      });
      onClose();
    },
  });

  const [points, setPoints] = useState("");
  const gradeNum = Number.parseFloat(points.replaceAll(",", "."));
  const isValid = !Number.isNaN(gradeNum) && gradeNum >= 0 && gradeNum <= 15;

  return (
    <View className="px-8 py-8">
      <Text variant="heading" className="text-center">
        Aktuelle Gesamtnote eintragen
      </Text>
      <View className="h-6" />
      <TextField autoFocus label="Punkte" value={points} onChangeText={setPoints} keyboardType="numeric" />
      <View className="h-6" />
      <Text className="text-lg">
        Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen Eltern bestätigt werden.
      </Text>

      {mostRecentConfirmedMasterGrade && (
        <>
          <View className="h-4" />
          <Divider />
          <View className="h-4" />
          <Text className="text-lg">Alternativ kannst du deine letzte bestätigte Note wiederherstellen:</Text>
          <View className="h-4" />
          <GradeCard
            grade={mostRecentConfirmedMasterGrade}
            action={{
              label: "Wiederherstellen",
              onClick: () =>
                restoreMutation.mutate({
                  studentId: userId,
                  course: courseId,
                  type: "MASTER",
                }),
            }}
          />
        </>
      )}

      <View className="h-6" />
      <Button
        disabled={!isValid}
        className="self-end"
        label="Speichern"
        onPress={() => {
          const date = new Date();
          upsertMutation.mutate({
            studentId: userId,
            courseId,
            date,
            result: gradeNum,
            type: "MASTER",
          });
        }}
      />
    </View>
  );
};
