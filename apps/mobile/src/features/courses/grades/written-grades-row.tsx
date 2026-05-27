import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { IconButton } from "~/components/icon-button";
import { Text } from "~/components/text";
import { formatGrade, isGradeConfirmed, type Grade } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { GradeCard } from "./grade-card";
import { GradeEditorSheet } from "./grade-editor-sheet";
import WrittenIcon from "./written/written.svg";

export const WrittenGradesRow = ({
  writtenGrades,
  courseId,
}: {
  writtenGrades: Grade[];
  courseId: string;
}) => {
  const { upsertGrade } = useMockApp();
  const [isAddVisible, setIsAddVisible] = useState(false);
  const averageWrittenGrade = useMemo(() => {
    const confirmedGrades = writtenGrades.filter((grade) => isGradeConfirmed(grade));
    if (confirmedGrades.length === 0) return null;
    return confirmedGrades.reduce((acc, grade) => acc + grade.result, 0) / confirmedGrades.length;
  }, [writtenGrades]);

  return (
    <>
      <View className="flex-row gap-4">
        <PortaledBottomSheet onClose={() => setIsAddVisible(false)}>
          {isAddVisible && (
            <GradeEditorSheet
              title="Klausur hinzufügen"
              initialResult={11}
              onClose={() => setIsAddVisible(false)}
              onSave={({ result, date }) => {
                upsertGrade({ courseId, type: "WRITTEN", result, date });
                setIsAddVisible(false);
              }}
            />
          )}
        </PortaledBottomSheet>

        <WrittenIcon
          width={64}
          height={64}
          style={{ opacity: writtenGrades.every((grade) => isGradeConfirmed(grade)) ? 1 : 0.25 }}
        />

        <View className="shrink grow">
          <View className="flex-row items-center justify-between">
            <Text className="grow text-3xl" weight="semi-bold">
              {averageWrittenGrade ? formatGrade(averageWrittenGrade) : "—"}
            </Text>
            <IconButton icon="add" opacity={0.8} size={24} onPress={() => setIsAddVisible(true)} />
          </View>
          <Text className="text-lg opacity-60">schriftlich</Text>
          {writtenGrades.length > 0 ? (
            <Text className="text-lg">Deine Note setzt sich aus diesen Ergebnissen zusammen:</Text>
          ) : null}
        </View>
      </View>

      <View className="h-4" />

      <View className="gap-4">
        {writtenGrades.map((grade) => (
          <GradeCard
            key={grade.id}
            grade={grade}
            action={
              isGradeConfirmed(grade)
                ? null
                : {
                    label: "Jetzt Bestätigen",
                    href: {
                      pathname: "/courses/[course]/grades/[type]/[date]",
                      params: { course: courseId, type: "WRITTEN", date: grade.date.getTime() },
                    },
                  }
            }
          />
        ))}
      </View>
    </>
  );
};
