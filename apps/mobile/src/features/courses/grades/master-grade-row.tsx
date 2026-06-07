import { format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/layout/bottom-sheet";
import { OutlinedButton } from "~/components/ui/button";
import { ConfirmationStatus } from "~/domain-ui/confirmation-status";
import { IconButton } from "~/components/ui/icon-button";
import { SystemIcon } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { colors } from "~/theme/colors";
import { formatGrade, isGradeConfirmed, type Grade } from "@stu/core";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import { gradeRoute } from "~/routing/params";
import { EditMasterGrade } from "./master/edit-master-grade";

export const MasterGradeRow = ({
  masterGrades,
  courseId,
}: {
  masterGrades: Grade[];
  courseId: string;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const [isEditVisible, setIsEditVisible] = useState(false);
  const currentMasterGrade = useMemo(() => masterGrades[0], [masterGrades]);
  const isConfirmed = currentMasterGrade
    ? isGradeConfirmed(currentMasterGrade, user.isOfAge)
    : false;

  const openGradeDetails = () => {
    if (!currentMasterGrade) {
      return;
    }

    router.push(gradeRoute({ courseId, date: currentMasterGrade.date, type: "MASTER" }));
  };

  return (
    <View className="flex-row gap-4">
      {isEditVisible ? (
        <PortaledBottomSheet onClose={() => setIsEditVisible(false)}>
          <EditMasterGrade
            courseId={courseId}
            masterGrades={masterGrades}
            onClose={() => setIsEditVisible(false)}
          />
        </PortaledBottomSheet>
      ) : null}

      <View style={{ opacity: !currentMasterGrade || isConfirmed ? 1 : 0.25 }}>
        <SystemIcon name="verified" size={64} color={colors.primary.DEFAULT} />
      </View>

      <View className="grow">
        <View className="flex-row items-center justify-between">
          <Text className="grow text-3xl" weight="semi-bold">
            {currentMasterGrade ? formatGrade(currentMasterGrade.result) : "—"}
          </Text>
          <IconButton
            accessibilityLabel="Gesamtnote bearbeiten"
            icon="edit"
            opacity={0.8}
            size={24}
            onPress={() => setIsEditVisible(true)}
          />
        </View>
        <Text className="text-lg opacity-60">aktuelle Gesamtnote</Text>
        <Text className="text-lg opacity-60">
          Stand: {currentMasterGrade ? format(currentMasterGrade.date, "dd.MM.yyyy") : "—"}
        </Text>
        {currentMasterGrade ? (
          <>
            <View className="h-2" />
            <View className="flex-row items-center justify-between gap-2">
              <ConfirmationStatus
                isOfAge={user.isOfAge}
                order="teacherParent"
                parent={Boolean(currentMasterGrade.parentSignature)}
                teacher={Boolean(currentMasterGrade.teacherSignature)}
              />
              {isConfirmed ? (
                <IconButton
                  accessibilityLabel="Gesamtnote ansehen"
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
