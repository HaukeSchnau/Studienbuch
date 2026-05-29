import { useMemo, useState } from "react";
import { View } from "react-native";
import { Button, TextButton } from "~/components/button";
import { Divider } from "~/components/divider";
import { SheetScaffold } from "~/components/sheet-scaffold";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { haptics } from "~/utils/haptics";
import { isGradeConfirmed, type Grade } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { GradeCard } from "../grade-card";

export const EditMasterGrade = ({
  courseId,
  onClose,
  masterGrades,
}: {
  courseId: string;
  onClose: () => void;
  masterGrades: Grade[];
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const { upsertGrade, restoreLatestConfirmedGrade } = useMockApp();
  const [points, setPoints] = useState("");
  const mostRecentConfirmedMasterGrade = useMemo(() => {
    const currentMasterGrade = masterGrades[0];
    const confirmedGrade =
      masterGrades.find((grade) => isGradeConfirmed(grade, user.isOfAge)) ?? null;
    return confirmedGrade !== currentMasterGrade ? confirmedGrade : null;
  }, [masterGrades, user.isOfAge]);
  const gradeNum = Number.parseFloat(points.replaceAll(",", "."));
  const isValid = !Number.isNaN(gradeNum) && gradeNum >= 0 && gradeNum <= 15;

  return (
    <SheetScaffold
      title="Aktuelle Gesamtnote eintragen"
      footer={
        <View className="flex-row items-center justify-end gap-4">
          <TextButton label="Abbrechen" onPress={onClose} />
          <Button
            disabled={!isValid}
            label="Speichern"
            onPress={() => {
              upsertGrade({
                courseId,
                date: new Date(),
                result: gradeNum,
                type: "MASTER",
              });
              haptics.success();
              onClose();
            }}
          />
        </View>
      }
    >
      <TextField
        autoFocus
        label="Punkte"
        value={points}
        onChangeText={setPoints}
        keyboardType="numeric"
      />
      <View className="h-6" />
      <Text className="text-lg">
        Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen Eltern bestätigt werden.
      </Text>

      {mostRecentConfirmedMasterGrade ? (
        <>
          <View className="h-4" />
          <Divider />
          <View className="h-4" />
          <Text className="text-lg">
            Alternativ kannst du deine letzte bestätigte Note wiederherstellen:
          </Text>
          <View className="h-4" />
          <GradeCard
            grade={mostRecentConfirmedMasterGrade}
            action={{
              label: "Wiederherstellen",
              onClick: () => {
                haptics.success();
                restoreLatestConfirmedGrade(courseId, "MASTER");
                onClose();
              },
            }}
          />
        </>
      ) : null}
    </SheetScaffold>
  );
};
