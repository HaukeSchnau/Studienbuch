import { useState } from "react";
import { View } from "react-native";
import { startOfDay } from "date-fns";

import type { Grade } from "@stu/lib";

import { Button } from "~/components/button";
import { Divider } from "~/components/divider";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { api } from "~/utils/api";
import { GradeCard } from "../grade-card";

export const AddWrittenGrade = ({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) => {
  const utils = api.useUtils();
  const upsertMutation = api.students.grades.upsert.useMutation({
    onSuccess: async () => {
      await utils.students.grades.invalidate();
      onClose();
    },
  });

  const restoreMutation = api.students.grades.restore.useMutation({
    onSuccess: async () => {
      await utils.students.grades.invalidate();
      onClose();
    },
  });

  const [points, setPoints] = useState("");
  const gradeNum = parseFloat(points.replaceAll(",", "."));
  const isValid = !isNaN(gradeNum) && gradeNum >= 0 && gradeNum <= 15;

  return (
    <View className="px-8 py-8">
      <Text variant="heading" className="text-center">
        Mündliche Mitarbeitsnote eintragen
      </Text>
      <View className="h-6" />
      <TextField
        autoFocus
        label="Punkte"
        value={points}
        onChangeText={setPoints}
        keyboardType="numeric"
      />
      <View className="h-6" />
      <Text className="text-lg">
        Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen
        Eltern bestätigt werden.
      </Text>

      <View className="h-6" />
      <Button
        disabled={!isValid}
        className="self-end"
        label="Speichern"
        onPress={() => {
          const date = startOfDay(new Date());
          upsertMutation.mutate({
            courseId,
            date,
            result: gradeNum,
            type: "ORAL",
          });
        }}
      />
    </View>
  );
};
