import { format } from "date-fns";
import { Link } from "expo-router";
import { Alert, TouchableOpacity, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { OutlinedButton } from "~/components/ui/button";
import { ConfirmationStatus } from "~/domain-ui/confirmation-status";
import { SystemIcon } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { haptics } from "~/platform/haptics";
import { isAbsenceConfirmed, subjectNameMap, type Absence } from "@stu/core";
import { useAbsences, useCourses } from "~/data/hooks";
import { absenceConfirmationRoute } from "~/routing/params";
import { colors } from "~/theme/colors";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";

export const AbsenceItem = ({ absence }: { absence: Absence }) => {
  const { user } = useRequiredAuthenticatedSession();
  const { deleteAbsence } = useAbsences();
  const { getCourse } = useCourses();
  const isExcused = isAbsenceConfirmed(absence, user.isOfAge);
  const courseLabels = absence.courseIds
    .map((courseId) => getCourse(courseId))
    .filter(Boolean)
    .map((course) => subjectNameMap[course!.subject])
    .join(", ");
  const confirmDelete = () =>
    Alert.alert("Fehlzeit löschen", "Bist du sicher, dass du diese Fehlzeit löschen möchtest?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: () => {
          haptics.warning();
          deleteAbsence(absence.id);
        },
      },
    ]);

  return (
    <ReanimatedSwipeable
      enableTrackpadTwoFingerGesture
      overshootRight={false}
      rightThreshold={48}
      renderRightActions={(progress, _translation, swipeableMethods) => (
        <DeleteAction
          progress={progress}
          onPress={() => {
            swipeableMethods.close();
            confirmDelete();
          }}
        />
      )}
      containerStyle={{ borderRadius: 16 }}
    >
      <View
        className={isExcused ? "rounded-2xl bg-primary-des p-6" : "rounded-2xl bg-danger-des p-6"}
      >
        <View className="flex-row gap-1">
          <View className="flex-1 gap-1">
            <Text>
              {format(absence.date, "dd.MM.yyyy")} ({courseLabels})
            </Text>
            <Text weight="medium" className="text-xl">
              {absence.reason}
            </Text>
            <ConfirmationStatus
              parent={Boolean(absence.parentSignature)}
              teacher={Boolean(absence.teacherSignature)}
              isOfAge={user.isOfAge}
              order="parentTeacher"
              confirmedText="Entschuldigt"
            />
          </View>
          {!isExcused && (
            <View className="items-end justify-center gap-1">
              <Link href={absenceConfirmationRoute(absence.date, absence.courseIds)} asChild>
                <OutlinedButton label="Unterschreiben" />
              </Link>
            </View>
          )}
        </View>
      </View>
    </ReanimatedSwipeable>
  );
};

const DeleteAction = ({
  progress,
  onPress,
}: {
  progress: SharedValue<number>;
  onPress: () => void;
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.35, 1]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [24, 0]) }],
  }));

  return (
    <Animated.View style={animatedStyle} className="h-full justify-center pl-3">
      <View
        className="h-full min-w-24 items-center justify-center rounded-2xl"
        style={{ backgroundColor: colors.danger.DEFAULT }}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          className="h-full min-w-24 items-center justify-center px-3"
        >
          <SystemIcon name="delete" color="white" size={18} />
          <View className="h-1.5" />
          <Text weight="bold" className="text-base text-white">
            Löschen
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};
