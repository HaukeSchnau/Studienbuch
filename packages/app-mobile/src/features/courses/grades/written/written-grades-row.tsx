import type { Grade } from "@stu/lib";
import { formatGrade, isGradeConfirmed } from "@stu/lib";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { IconButton } from "~/components/icon-button";
import { Text } from "~/components/text";
import { GradeCard } from "../grade-card";
import { AddWrittenGrade } from "./add-written-grade";
import WrittenIcon from "./written.svg";

export const WrittenGradesRow = ({ writtenGrades, courseId }: { writtenGrades: Grade[]; courseId: string }) => {
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
    <>
      <View className="flex-row gap-4">
        <PortaledBottomSheet onClose={() => setIsAddVisible(false)}>
          {isAddVisible && <AddWrittenGrade courseId={courseId} onClose={() => setIsAddVisible(false)} />}
        </PortaledBottomSheet>

        <WrittenIcon
          width={64}
          height={64}
          style={{
            opacity: areAllGradesConfirmed ? 1 : 0.25,
          }}
        />

        <View className="shrink grow">
          <View className="flex-row items-center justify-between">
            <Text className="grow text-3xl" weight="semi-bold">
              {averageWrittenGrade ? formatGrade(averageWrittenGrade) : "—"}
            </Text>

            <IconButton icon="add" opacity={0.8} size={24} onPress={() => setIsAddVisible(true)} />
          </View>
          <Text className="text-lg opacity-60">schriftlich</Text>
          {writtenGrades.length > 0 && (
            <Text className="text-lg">Deine Note setzt sich aus diesen Ergebnissen zusammen:</Text>
          )}
        </View>
      </View>

      <View className="h-4" />

      <View className="gap-4">
        {writtenGrades.map((grade) => (
          <GradeCard
            key={grade.date.toISOString()}
            grade={grade}
            action={
              isGradeConfirmed(grade)
                ? null
                : {
                    label: "Jetzt Bestätigen",
                    href: {
                      pathname: "/courses/[course]/grades/[type]/[date]",
                      params: {
                        course: courseId,
                        type: "WRITTEN",
                        date: grade.date.getTime(),
                      },
                    },
                  }
            }
          />
        ))}
      </View>
    </>
  );
};
