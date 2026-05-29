import { format } from "date-fns";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { PortaledBottomSheet } from "~/components/bottom-sheet";
import { ConfirmationStatus } from "~/components/confirmation-status";
import { SystemIcon } from "~/components/system-icon";
import { Text } from "~/components/text";
import { colors } from "~/theme/colors";
import { formatGrade, isGradeConfirmed, type Grade } from "~/mock-app/domain";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { GradeRowActions } from "./grade-row-actions";
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

  return (
    <ReanimatedSwipeable
      enabled={Boolean(currentMasterGrade)}
      enableTrackpadTwoFingerGesture
      overshootRight={false}
      rightThreshold={56}
      renderRightActions={(progress, _translation, swipeableMethods) =>
        currentMasterGrade ? (
          <GradeRowActions
            progress={progress}
            secondary={{
              icon: "edit",
              label: "Bearbeiten",
              color: colors.accent.sec,
              onPress: () => {
                swipeableMethods.close();
                setIsEditVisible(true);
              },
            }}
            primary={{
              icon: isConfirmed ? "visibility" : "check",
              label: isConfirmed ? "Ansehen" : "Bestätigen",
              color: isConfirmed ? colors.accent.DEFAULT : colors.primary.DEFAULT,
              onPress: () => {
                swipeableMethods.close();
                router.push({
                  pathname: "/courses/[course]/grades/[type]/[date]",
                  params: {
                    course: courseId,
                    date: currentMasterGrade.date.getTime(),
                    type: "MASTER",
                  },
                });
              },
            }}
          />
        ) : null
      }
      containerStyle={{ borderRadius: 24 }}
    >
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
              <View className="h-1" />
              <Text className="text-sm opacity-55">Nach links wischen für Aktionen</Text>
            </>
          ) : null}
        </View>
      </View>
    </ReanimatedSwipeable>
  );
};
