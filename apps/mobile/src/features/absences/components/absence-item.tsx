import { format } from "date-fns";
import { router } from "expo-router";
import { Alert, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { PressableSurface } from "~/ui/feedback/pressable-surface";
import { ConfirmationStatus } from "~/domain-ui/confirmation-status";
import { SystemIcon } from "~/ui/system-icon";
import { Text } from "~/ui/text";
import { haptics } from "~/infra/native/haptics";
import { isAbsenceConfirmed, subjectNameMap, type Absence } from "~/compat/mobile-v0";
import { useCourses } from "~/features/courses";
import { absenceConfirmationRoute } from "~/infra/routing/params";
import { colors } from "~/ui/colors";
import { useProfile } from "~/features/profile";
import { useAbsences } from "../use-absences";

export const AbsenceItem = ({ absence }: { absence: Absence }) => {
  const { profile: user } = useProfile();
  const { deleteAbsence } = useAbsences();
  const { getCourse } = useCourses();
  const isExcused = isAbsenceConfirmed(absence, user.isOfAge);
  const courseLabels = absence.courseIds
    .map((courseId) => getCourse(courseId))
    .filter((course) => course !== undefined)
    .map((course) => subjectNameMap[course.subject])
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
  const openConfirmation = () =>
    router.push(absenceConfirmationRoute(absence.date, absence.courseIds));
  const content = (
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
        <View className="items-end justify-center gap-2">
          <View className="rounded-full border border-danger/25 bg-white/70 px-3 py-2">
            <Text weight="bold" className="text-sm text-danger">
              Unterschreiben
            </Text>
          </View>
          <SystemIcon name="arrow-right" size={18} color={colors.danger.DEFAULT} />
        </View>
      )}
    </View>
  );

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
      {isExcused ? (
        <View className="rounded-2xl bg-primary-des p-6">{content}</View>
      ) : (
        <PressableSurface
          accessibilityLabel={`${format(absence.date, "dd.MM.yyyy")} (${courseLabels}), ${
            absence.reason
          }, Unterschreiben`}
          borderRadius={16}
          className="bg-danger-des p-6"
          highlightColor="rgba(164, 43, 51, 0.08)"
          onPress={openConfirmation}
          pressedScale={0.985}
        >
          {content}
        </PressableSurface>
      )}
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
      <PressableSurface
        accessibilityLabel="Fehlzeit löschen"
        borderRadius={16}
        className="h-full min-w-24 items-center justify-center rounded-2xl px-3"
        onPress={onPress}
        pressedScale={0.96}
        style={{ backgroundColor: colors.danger.DEFAULT }}
      >
        <SystemIcon name="delete" color="white" size={18} />
        <View className="h-1.5" />
        <Text weight="bold" className="text-base text-white">
          Löschen
        </Text>
      </PressableSurface>
    </Animated.View>
  );
};
