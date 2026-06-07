import { format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { OutlinedButton } from "~/components/ui/button";
import { ConfirmationStatus } from "~/domain-ui/confirmation-status";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { formatGrade, isGradeConfirmed, type Grade } from "@stu/core";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import { gradeRoute } from "~/routing/params";
import { EditOralGrade } from "./oral/edit-oral-grade";
import OralIcon from "./oral/oral.svg";

export const OralGradesRow = ({
  oralGrades,
  courseId,
}: {
  oralGrades: Grade[];
  courseId: string;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const [isEditVisible, setIsEditVisible] = useState(false);
  const currentOralGrade = useMemo(() => oralGrades[0], [oralGrades]);
  const isConfirmed = currentOralGrade ? isGradeConfirmed(currentOralGrade, user.isOfAge) : false;

  const openGradeDetails = () => {
    if (!currentOralGrade) {
      return;
    }

    router.push(gradeRoute({ courseId, date: currentOralGrade.date, type: "ORAL" }));
  };

  return (
    <View className="flex-row gap-4">
      {isEditVisible ? (
        <PortaledBottomSheet onClose={() => setIsEditVisible(false)}>
          <EditOralGrade
            courseId={courseId}
            oralGrades={oralGrades}
            onClose={() => setIsEditVisible(false)}
          />
        </PortaledBottomSheet>
      ) : null}

      <OralIcon
        width={64}
        height={64}
        style={{
          opacity: !currentOralGrade || isGradeConfirmed(currentOralGrade, user.isOfAge) ? 1 : 0.25,
        }}
      />

      <View className="grow">
        <View className="flex-row items-center justify-between">
          <Text className="grow text-3xl" weight="semi-bold">
            {currentOralGrade ? formatGrade(currentOralGrade.result) : "—"}
          </Text>
          <IconButton
            accessibilityLabel="Mündliche Note bearbeiten"
            icon="edit"
            opacity={0.8}
            size={24}
            onPress={() => setIsEditVisible(true)}
          />
        </View>
        <Text className="text-lg opacity-60">mündlich</Text>
        <Text className="text-lg opacity-60">
          Stand: {currentOralGrade ? format(currentOralGrade.date, "dd.MM.yyyy") : "—"}
        </Text>
        {currentOralGrade ? (
          <>
            <View className="h-2" />
            <View className="flex-row items-center justify-between gap-2">
              <ConfirmationStatus
                isOfAge={user.isOfAge}
                order="teacherParent"
                parent={Boolean(currentOralGrade.parentSignature)}
                teacher={Boolean(currentOralGrade.teacherSignature)}
              />
              {isConfirmed ? (
                <IconButton
                  accessibilityLabel="Mündliche Note ansehen"
                  icon="visibility"
                  opacity={0.8}
                  size={24}
                  onPress={openGradeDetails}
                />
              ) : null}
            </View>
            {!isConfirmed ? (
              <View className="flex-row justify-end">
                <OutlinedButton label="Jetzt bestätigen" onPress={openGradeDetails} />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
};
