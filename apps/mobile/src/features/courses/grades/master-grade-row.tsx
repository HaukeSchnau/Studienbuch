import { format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { Button, TextButton } from "~/components/button";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { SystemIcon } from "~/components/system-icon";
import { Text } from "~/components/text";
import { colors } from "~/theme/colors";
import { formatGrade, isGradeConfirmed, type Grade } from "~/mock-app/domain";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
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

    router.push({
      pathname: "/courses/[course]/grades/[type]/[date]",
      params: {
        course: courseId,
        date: currentMasterGrade.date.getTime(),
        type: "MASTER",
      },
    });
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
        <Text className="grow text-3xl" weight="semi-bold">
          {currentMasterGrade ? formatGrade(currentMasterGrade.result) : "—"}
        </Text>
        <Text className="text-lg opacity-60">aktuelle Gesamtnote</Text>
        <Text className="text-lg opacity-60">
          Stand: {currentMasterGrade ? format(currentMasterGrade.date, "dd.MM.yyyy") : "—"}
        </Text>
        {currentMasterGrade ? (
          <>
            <View className="h-2" />
            <View className="flex-row items-center gap-2">
              <ConfirmationStatus
                isOfAge={user.isOfAge}
                order="teacherParent"
                parent={Boolean(currentMasterGrade.parentSignature)}
                teacher={Boolean(currentMasterGrade.teacherSignature)}
              />
            </View>
            <View className="h-2" />
            <View className="flex-row flex-wrap items-center gap-2">
              <TextButton label="Bearbeiten" size="sm" onPress={() => setIsEditVisible(true)} />
              <Button
                label={isConfirmed ? "Ansehen" : "Bestätigen"}
                size="sm"
                onPress={openGradeDetails}
              />
            </View>
          </>
        ) : (
          <>
            <View className="h-2" />
            <View className="flex-row flex-wrap items-center gap-2">
              <Button label="Eintragen" size="sm" onPress={() => setIsEditVisible(true)} />
            </View>
          </>
        )}
      </View>
    </View>
  );
};
