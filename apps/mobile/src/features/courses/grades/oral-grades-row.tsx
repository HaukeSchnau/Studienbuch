import { format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/ui/layout/bottom-sheet";
import { OutlinedButton } from "~/ui/button";
import { ConfirmationStatus } from "~/domain-ui/confirmation-status";
import { IconButton } from "~/ui/icon-button";
import { Text } from "~/ui/text";
import { formatGrade, isGradeConfirmed, type Grade } from "~/compat/mobile-v0";
import { useRequiredAuthenticatedSession } from "~/infra/session/session";
import { gradeRoute } from "~/infra/routing/params";
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
          opacity:
            !currentOralGrade || isGradeConfirmed(currentOralGrade, user.isOfAge) ? 0.72 : 0.25,
        }}
      />

      <View className="min-w-0 flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            adjustsFontSizeToFit
            className="min-w-0 flex-1 pr-2 text-[25px] leading-[31px]"
            minimumFontScale={0.82}
            numberOfLines={1}
            weight="semi-bold"
          >
            {currentOralGrade ? formatGrade(currentOralGrade.result) : "Noch keine Note"}
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
          {currentOralGrade
            ? `Stand: ${format(currentOralGrade.date, "dd.MM.yyyy")}`
            : "Tippe auf den Stift, wenn du eine Rückmeldung bekommst."}
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
