import { useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/button";
import { Divider } from "~/components/divider";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
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
    <View className="px-8 py-8">
      <Text variant="heading" className="text-center">
        Aktuelle Gesamtnote eintragen
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
                restoreLatestConfirmedGrade(courseId, "MASTER");
                onClose();
              },
            }}
          />
        </>
      ) : null}

      <View className="h-6" />
      <Button
        disabled={!isValid}
        className="self-end"
        label="Speichern"
        onPress={() => {
          upsertGrade({
            courseId,
            date: new Date(),
            result: gradeNum,
            type: "MASTER",
          });
          onClose();
        }}
      />
    </View>
  );
};
