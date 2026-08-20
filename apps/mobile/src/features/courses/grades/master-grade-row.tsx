import { format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/ui/layout/bottom-sheet";
import { OutlinedButton } from "~/ui/button";
import { ConfirmationStatus } from "~/domain-ui/confirmation-status";
import { IconButton } from "~/ui/icon-button";
import { SystemIcon } from "~/ui/system-icon";
import { Text } from "~/ui/text";
import { colors } from "~/ui/colors";
import { formatGrade, isGradeConfirmed, type Grade } from "@/compat/mobile-v0";
import { useRequiredAuthenticatedSession } from "~/infra/session/session";
import { gradeRoute } from "~/infra/routing/params";
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

      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            adjustsFontSizeToFit
            className="min-w-0 flex-1 pr-2 text-[25px] leading-[31px]"
            minimumFontScale={0.82}
            numberOfLines={1}
            weight="semi-bold"
          >
            {currentMasterGrade ? formatGrade(currentMasterGrade.result) : "Noch keine Note"}
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
          {currentMasterGrade
            ? `Stand: ${format(currentMasterGrade.date, "dd.MM.yyyy")}`
            : "Tippe auf den Stift, sobald du sie kennst."}
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
