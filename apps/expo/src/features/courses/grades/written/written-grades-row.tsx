import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import Icon from "@expo/vector-icons/MaterialIcons";
import { format } from "date-fns";

import type { Grade } from "@stu/lib";
import { formatGrade, isGradeConfirmed } from "@stu/lib";
import { colors } from "@stu/tailwind-config/native";

import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { OutlinedButton } from "~/components/button";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { IconButton } from "~/components/icon-button";
import { Text } from "~/components/text";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { AddWrittenGrade } from "./add-written-grade";
import WrittenIcon from "./written.svg";

export const WrittenGradesRow = ({
  writtenGrades,
  courseId,
}: {
  writtenGrades: Grade[];
  courseId: string;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const averageWrittenGrade = useMemo(() => {
    const confirmedGrades = writtenGrades.filter(isGradeConfirmed);

    if (!confirmedGrades.length) {
      return null;
    }

    const sum = confirmedGrades.reduce((acc, grade) => acc + grade.result, 0);
    return sum / confirmedGrades.length;
  }, [writtenGrades]);

  const [isAddVisible, setIsAddVisible] = useState(false);

  const areAllGradesConfirmed = writtenGrades.every(isGradeConfirmed);

  return (
    <View className="flex-row gap-4">
      <PortaledBottomSheet onClose={() => setIsAddVisible(false)}>
        {isAddVisible && (
          <AddWrittenGrade
            courseId={courseId}
            onClose={() => setIsAddVisible(false)}
          />
        )}
      </PortaledBottomSheet>

      <WrittenIcon
        width={64}
        height={64}
        style={{
          opacity: areAllGradesConfirmed ? 1 : 0.25,
        }}
      />

      <View className="grow">
        <View className="flex-row items-center justify-between">
          <Text className="grow text-3xl" weight="semi-bold">
            {averageWrittenGrade ? formatGrade(averageWrittenGrade) : "—"}
          </Text>

          <IconButton
            icon="add"
            opacity={0.8}
            size={24}
            onPress={() => setIsAddVisible(true)}
          />
        </View>
        <Text className="text-lg opacity-60">schriftlich</Text>
        {writtenGrades.length > 0 && (
          <Text className="text-lg">
            Deine Note setzt sich aus diesen Ergebnissen zusammen:
          </Text>
        )}
      </View>

      {/* {writtenGrades.length} */}
    </View>
  );
};
