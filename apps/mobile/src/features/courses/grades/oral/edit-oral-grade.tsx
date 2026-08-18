import { useMemo, useState } from "react";
import { View } from "react-native";

import { Button, TextButton } from "~/components/ui/button";
import { Divider } from "~/components/ui/divider";
import { SheetCallout } from "~/components/layout/sheet-callout";
import { SheetScaffold } from "~/components/layout/sheet-scaffold";
import { TextField } from "~/components/fields/text-field";
import { isGradeConfirmed, type Grade } from "@/compat/mobile-v0";
import { useGrades } from "~/data/hooks";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import { haptics } from "~/platform/haptics";
import { GradeCard } from "../grade-card";

export const EditOralGrade = ({
  courseId,
  onClose,
  oralGrades,
}: {
  courseId: string;
  onClose: () => void;
  oralGrades: Grade[];
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const { upsertGrade, restoreLatestConfirmedGrade } = useGrades();
  const [points, setPoints] = useState("");
  const mostRecentConfirmedOralGrade = useMemo(() => {
    const currentOralGrade = oralGrades[0];
    const confirmedGrade =
      oralGrades.find((grade) => isGradeConfirmed(grade, user.isOfAge)) ?? null;
    return confirmedGrade !== currentOralGrade ? confirmedGrade : null;
  }, [oralGrades, user.isOfAge]);
  const gradeNum = Number.parseFloat(points.replaceAll(",", "."));
  const isValid = !Number.isNaN(gradeNum) && gradeNum >= 0 && gradeNum <= 15;

  return (
    <SheetScaffold
      title="Mündliche Mitarbeitsnote eintragen"
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
                type: "ORAL",
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
      <SheetCallout>
        Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen Eltern bestätigt werden.
      </SheetCallout>

      {mostRecentConfirmedOralGrade ? (
        <>
          <Divider />
          <SheetCallout>
            Alternativ kannst du deine letzte bestätigte Note wiederherstellen:
          </SheetCallout>
          <GradeCard
            grade={mostRecentConfirmedOralGrade}
            action={{
              label: "Wiederherstellen",
              onClick: () => {
                haptics.success();
                restoreLatestConfirmedGrade(courseId, "ORAL");
                onClose();
              },
            }}
          />
        </>
      ) : null}
    </SheetScaffold>
  );
};
