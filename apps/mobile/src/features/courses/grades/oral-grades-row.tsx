import { format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { Button, TextButton } from "~/components/button";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { Text } from "~/components/text";
import { formatGrade, isGradeConfirmed, type Grade } from "~/mock-app/domain";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
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

    router.push({
      pathname: "/courses/[course]/grades/[type]/[date]",
      params: {
        course: courseId,
        date: currentOralGrade.date.getTime(),
        type: "ORAL",
      },
    });
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
        <Text className="grow text-3xl" weight="semi-bold">
          {currentOralGrade ? formatGrade(currentOralGrade.result) : "—"}
        </Text>
        <Text className="text-lg opacity-60">mündlich</Text>
        <Text className="text-lg opacity-60">
          Stand: {currentOralGrade ? format(currentOralGrade.date, "dd.MM.yyyy") : "—"}
        </Text>
        {currentOralGrade ? (
          <>
            <View className="h-2" />
            <View className="flex-row items-center gap-2">
              <ConfirmationStatus
                isOfAge={user.isOfAge}
                order="teacherParent"
                parent={Boolean(currentOralGrade.parentSignature)}
                teacher={Boolean(currentOralGrade.teacherSignature)}
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
