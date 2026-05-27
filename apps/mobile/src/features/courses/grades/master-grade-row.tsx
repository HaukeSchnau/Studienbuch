import Icon from "@expo/vector-icons/MaterialIcons";
import { format } from "date-fns";
import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { IconButton } from "~/components/icon-button";
import { OutlinedButton } from "~/components/button";
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

  return (
    <View className="flex-row gap-4">
      <PortaledBottomSheet onClose={() => setIsEditVisible(false)}>
        {isEditVisible && (
          <EditMasterGrade
            courseId={courseId}
            masterGrades={masterGrades}
            onClose={() => setIsEditVisible(false)}
          />
        )}
      </PortaledBottomSheet>

      <Icon
        name="star"
        size={64}
        color={colors.primary.DEFAULT}
        style={{
          opacity:
            !currentMasterGrade || isGradeConfirmed(currentMasterGrade, user.isOfAge) ? 1 : 0.25,
        }}
      />

      <View className="grow">
        <View className="flex-row items-center justify-between">
          <Text className="grow text-3xl" weight="semi-bold">
            {currentMasterGrade ? formatGrade(currentMasterGrade.result) : "—"}
          </Text>
          <IconButton icon="edit" opacity={0.8} size={24} onPress={() => setIsEditVisible(true)} />
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
              {isGradeConfirmed(currentMasterGrade, user.isOfAge) ? (
                <Link
                  href={{
                    pathname: "/courses/[course]/grades/[type]/[date]",
                    params: {
                      course: courseId,
                      date: currentMasterGrade.date.getTime(),
                      type: "MASTER",
                    },
                  }}
                  asChild
                >
                  <IconButton icon="visibility" opacity={0.8} size={24} />
                </Link>
              ) : null}
            </View>
            {!isGradeConfirmed(currentMasterGrade, user.isOfAge) ? (
              <View className="flex-row justify-end">
                <Link
                  href={{
                    pathname: "/courses/[course]/grades/[type]/[date]",
                    params: {
                      course: courseId,
                      date: currentMasterGrade.date.getTime(),
                      type: "MASTER",
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
