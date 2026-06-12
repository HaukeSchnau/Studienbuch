import { useRouter } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { SystemIcon } from "~/components/ui/system-icon";
import { Text } from "~/components/ui/text";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import type { ProfileCourseSignal } from "./profile-model";
import { getProfileCoursesModel } from "./profile-model";
import type { Course, Semester } from "@stu/core";
import { subjectNameMap, Teacher } from "@stu/core";
import { useCourses, useGrades, useSessionData, useTasks } from "~/data/hooks";
import { courseRoute } from "~/routing/params";
import { colors } from "~/theme/colors";

export const CourseList = ({ semester }: { semester: Semester }) => {
  const { getSemesterCourses } = useCourses();
  const { getCourseGrades } = useGrades();
  const { getCourseTasks } = useTasks();
  const { user } = useSessionData();
  const courses = getSemesterCourses(semester.id);
  const router = useRouter();
  const model = getProfileCoursesModel({
    courses,
    getCourseGrades,
    getCourseTasks,
    isOfAge: user.isOfAge,
  });

  if (courses.length === 0) {
    return (
      <View className="rounded-[28px] border border-[#DDE6F1] bg-white px-5 py-5">
        <Text className="text-[20px] leading-7 text-primary-text" weight="bold">
          Noch keine Kurse
        </Text>
        <Text className="pt-1 text-[16px] leading-6 text-[#5B6472]">
          Füge deine Kurse in den Einstellungen hinzu.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-6">
      {model.examCourses.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title="Prüfungsfächer" detail={`${model.examCourses.length} Fächer`} />
          {model.featuredExamCourses.length > 0 ? (
            <View className="flex-row gap-3">
              {model.featuredExamCourses.map((signal) => (
                <View key={signal.course.id} className="min-w-0 flex-1">
                  <FeaturedExamCourseCard
                    signal={signal}
                    onPress={() => router.push(courseRoute(signal.course.id))}
                  />
                </View>
              ))}
            </View>
          ) : null}
          {model.compactExamCourses.length > 0 ? (
            <View className="flex-row flex-wrap gap-3">
              {model.compactExamCourses.map((signal) => (
                <View key={signal.course.id} style={{ flexShrink: 0, width: "47%" }}>
                  <CompactExamCourseCard
                    signal={signal}
                    onPress={() => router.push(courseRoute(signal.course.id))}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="gap-3">
        <SectionHeader title="Weitere Kurse" detail={`${model.regularCourses.length} Kurse`} />
        {model.regularCourses.length > 0 ? (
          <View className="overflow-hidden rounded-[26px] border border-[#DDE6F1] bg-white">
            {model.regularCourses.map((signal, index) => (
              <View key={signal.course.id}>
                <CourseRow
                  signal={signal}
                  onPress={() => router.push(courseRoute(signal.course.id))}
                />
                {index < model.regularCourses.length - 1 ? (
                  <View className="ml-[76px] h-px bg-[#E7EDF4]" />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View className="rounded-[26px] border border-[#DDE6F1] bg-white px-5 py-4">
            <Text className="text-[15px] leading-5 text-[#5B6472]">
              Alle Kurse dieses Halbjahrs sind Prüfungsfächer.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const SectionHeader = ({ title, detail }: { title: string; detail: string }) => (
  <View className="flex-row items-end justify-between px-1">
    <Text className="text-[22px] leading-7 text-primary-text" weight="bold">
      {title}
    </Text>
    <Text className="text-[14px] leading-5 text-[#718095]" weight="medium">
      {detail}
    </Text>
  </View>
);

const FeaturedExamCourseCard = ({
  signal,
  onPress,
}: {
  signal: ProfileCourseSignal;
  onPress: () => void;
}) => (
  <View style={styles.featuredShadow}>
    <PressableSurface
      accessibilityLabel={courseAccessibilityLabel(signal.course)}
      borderRadius={28}
      className="min-h-[188px] bg-white p-4"
      haptic="impact"
      onPress={onPress}
      pressedScale={0.985}
      style={styles.featuredBorder}
    >
      <View className="flex-1 justify-between gap-3">
        <View className="gap-3">
          <View className="flex-row items-start justify-between gap-2">
            <View className="h-[54px] w-[54px] items-center justify-center rounded-[19px] bg-primary-des">
              <SubjectIcon subject={signal.course.subject} size={34} />
            </View>
            <ExamSlotBadge slot={signal.course.examSlot} elevated />
          </View>
          <View className="gap-1">
            <Text
              className="text-[18px] leading-6 text-primary-text"
              weight="bold"
              numberOfLines={2}
            >
              {signal.course.name}
            </Text>
            <Text className="text-[13px] leading-5 text-[#5B6472]" numberOfLines={1}>
              {courseTeacherLabel(signal.course)}
            </Text>
          </View>
        </View>
        <View className="flex-row items-end justify-between gap-3 pb-2">
          <GradeBadge signal={signal} large />
          <SecondaryGradeLine signal={signal} compact stacked />
        </View>
      </View>
    </PressableSurface>
  </View>
);

const CompactExamCourseCard = ({
  signal,
  onPress,
}: {
  signal: ProfileCourseSignal;
  onPress: () => void;
}) => (
  <PressableSurface
    accessibilityLabel={courseAccessibilityLabel(signal.course)}
    borderRadius={24}
    className="min-h-[136px] border border-[#DDE6F1] bg-white p-3"
    onPress={onPress}
    pressedScale={0.987}
  >
    <View className="flex-1 justify-between gap-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="h-10 w-10 items-center justify-center rounded-[15px] bg-accent-des">
          <SubjectIcon subject={signal.course.subject} size={25} />
        </View>
        <ExamSlotBadge slot={signal.course.examSlot} />
      </View>
      <View>
        <Text className="text-[15px] leading-5 text-primary-text" weight="bold" numberOfLines={1}>
          {subjectNameMap[signal.course.subject]}
        </Text>
        <View className="h-1" />
        <View className="gap-1">
          <GradeBadge signal={signal} />
          <SecondaryGradeLine signal={signal} />
        </View>
      </View>
    </View>
  </PressableSurface>
);

const CourseRow = ({ signal, onPress }: { signal: ProfileCourseSignal; onPress: () => void }) => (
  <PressableSurface
    accessibilityLabel={courseAccessibilityLabel(signal.course)}
    borderRadius={0}
    className="bg-white px-4 py-3.5"
    haptic="selection"
    onPress={onPress}
    pressedScale={1}
  >
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-[16px] bg-accent-des">
        <SubjectIcon subject={signal.course.subject} size={27} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text
            className="min-w-0 flex-1 text-[17px] leading-6 text-primary-text"
            weight="bold"
            numberOfLines={1}
          >
            {signal.course.name}
          </Text>
          {signal.taskSignal ? <TaskPill label={signal.taskSignal} /> : null}
        </View>
        <Text className="text-[13px] leading-5 text-[#5B6472]" numberOfLines={1}>
          {courseTeacherLabel(signal.course)}
        </Text>
        <SecondaryGradeLine signal={signal} />
      </View>
      <View className="items-end gap-1">
        <GradeBadge signal={signal} />
        <SystemIcon name="chevron-right" size={18} color="#9AA8B8" />
      </View>
    </View>
  </PressableSurface>
);

const GradeBadge = ({ signal, large }: { signal: ProfileCourseSignal; large?: boolean }) => {
  if (!signal.primaryGrade) {
    return (
      <View
        className="items-center justify-center rounded-full bg-[#F2F5F8]"
        style={{ minWidth: large ? 76 : 52, height: large ? 44 : 32 }}
      >
        <Text className={large ? "text-[16px]" : "text-[13px]"} weight="bold">
          --
        </Text>
      </View>
    );
  }

  return (
    <View
      className="items-center justify-center rounded-full bg-primary px-3"
      style={{ minWidth: large ? 78 : 56, height: large ? 46 : 34 }}
    >
      <Text
        className={large ? "text-[17px] leading-6 text-white" : "text-[14px] leading-4 text-white"}
        weight="bold"
      >
        {signal.primaryGrade.value}
      </Text>
    </View>
  );
};

const SecondaryGradeLine = ({
  signal,
  compact,
  stacked,
}: {
  signal: ProfileCourseSignal;
  compact?: boolean;
  stacked?: boolean;
}) => {
  const oral = signal.oralGrade ?? "-";
  const written = signal.writtenGrade ?? "-";

  if (stacked) {
    return (
      <View className="min-w-0 flex-1 items-end">
        <Text className="text-right text-[11px] leading-4 text-[#718095]" numberOfLines={1}>
          mdl. {oral}
        </Text>
        <Text className="text-right text-[11px] leading-4 text-[#718095]" numberOfLines={1}>
          schr. {written}
        </Text>
      </View>
    );
  }

  return (
    <Text
      className={
        compact
          ? "text-right text-[11px] leading-4 text-[#718095]"
          : "text-[13px] leading-5 text-[#718095]"
      }
      numberOfLines={1}
    >
      mdl. {oral} · schr. {written}
    </Text>
  );
};

const ExamSlotBadge = ({ slot, elevated }: { slot?: string; elevated?: boolean }) => {
  if (!slot) {
    return null;
  }

  return (
    <View
      className="items-center justify-center rounded-full px-2.5"
      style={{
        backgroundColor: elevated ? colors.accent.DEFAULT : colors.accent.des,
        minHeight: elevated ? 30 : 26,
      }}
    >
      <Text
        className={
          elevated ? "text-[13px] leading-4 text-white" : "text-[12px] leading-4 text-[#3F638F]"
        }
        weight="bold"
      >
        {slot}
      </Text>
    </View>
  );
};

const TaskPill = ({ label }: { label: string }) => (
  <View className="rounded-full bg-alert-des px-2 py-0.5">
    <Text className="text-[11px] leading-4 text-[#8A6500]" weight="bold" numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const courseTeacherLabel = (course: Course) =>
  course.teachers.map((teacher) => Teacher.formalNameShort(teacher)).join(", ");

const courseAccessibilityLabel = (course: Course) =>
  `${course.examSlot ? `${course.examSlot}, ` : ""}${subjectNameMap[course.subject]}, ${
    course.name
  }`;

const styles = StyleSheet.create({
  featuredBorder: {
    borderColor: "#DDE6F1",
    borderWidth: 1,
  },
  featuredShadow: {
    borderRadius: 28,
    boxShadow: Platform.OS === "web" ? "0px 10px 24px rgba(32, 55, 85, 0.08)" : undefined,
    elevation: Platform.OS === "android" ? 2 : 0,
    shadowColor: "#203755",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
    shadowRadius: 18,
  },
});
