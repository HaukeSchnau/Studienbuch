import { format } from "date-fns";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { IconButton } from "~/components/icon-button";
import { OutlinedButton } from "~/components/button";
import { Text } from "~/components/text";
import { formatGrade, isGradeConfirmed, type Grade } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { GradeEditorSheet } from "./grade-editor-sheet";
import OralIcon from "./oral/oral.svg";

export const OralGradesRow = ({
  oralGrades,
  courseId,
}: {
  oralGrades: Grade[];
  courseId: string;
}) => {
  const { user } = useRequiredAuthenticatedSession();
  const { upsertGrade } = useMockApp();
  const [isEditVisible, setIsEditVisible] = useState(false);
  const currentOralGrade = useMemo(() => oralGrades[0], [oralGrades]);

  return (
    <View className="flex-row gap-4">
      <PortaledBottomSheet onClose={() => setIsEditVisible(false)}>
        {isEditVisible && (
          <GradeEditorSheet
            title="Mündliche Note bearbeiten"
            initialResult={currentOralGrade?.result ?? 11}
            initialDate={currentOralGrade?.date}
            onClose={() => setIsEditVisible(false)}
            onSave={({ result, date }) => {
              upsertGrade({ courseId, type: "ORAL", result, date });
              setIsEditVisible(false);
            }}
          />
        )}
      </PortaledBottomSheet>

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
          <IconButton icon="edit" opacity={0.8} size={24} onPress={() => setIsEditVisible(true)} />
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
              {isGradeConfirmed(currentOralGrade, user.isOfAge) ? (
                <Link
                  href={{
                    pathname: "/courses/[course]/grades/[type]/[date]",
                    params: {
                      course: courseId,
                      date: currentOralGrade.date.getTime(),
                      type: "ORAL",
                    },
                  }}
                  asChild
                >
                  <IconButton icon="visibility" opacity={0.8} size={24} />
                </Link>
              ) : null}
            </View>
            {!isGradeConfirmed(currentOralGrade, user.isOfAge) ? (
              <View className="flex-row justify-end">
                <Link
                  href={{
                    pathname: "/courses/[course]/grades/[type]/[date]",
                    params: {
                      course: courseId,
                      date: currentOralGrade.date.getTime(),
                      type: "ORAL",
                    },
                  }}
                  asChild
                >
                  <OutlinedButton label="Jetzt bestätigen" />
                </Link>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
};
