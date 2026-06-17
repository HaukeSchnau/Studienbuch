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
    <View className="gap-4">
      {model.featuredExamCourses.length > 0 ? (
        <View className="gap-2.5">
          <SectionHeader title="Leistungskurse" />
          <View className="flex-row gap-3.5">
            {model.featuredExamCourses.map((signal) => (
              <View key={signal.course.id} className="min-w-0 flex-1">
                <FeaturedExamCourseCard
                  signal={signal}
                  onPress={() => router.push(courseRoute(signal.course.id))}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {model.compactExamCourses.length > 0 ? (
        <View className="gap-2.5">
          <SectionHeader title="Weitere Abiturfächer" />
          <View className="flex-row gap-2.5">
            {model.compactExamCourses.map((signal) => (
              <View key={signal.course.id} className="min-w-0 flex-1">
                <CompactExamCourseCard
                  signal={signal}
                  onPress={() => router.push(courseRoute(signal.course.id))}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <EncouragementCard />

      {model.regularCourses.length > 0 ? (
        <View className="gap-2.5">
          <SectionHeader title="Weitere Kurse" />
          <View className="overflow-hidden rounded-[26px] border border-[#DDE6F1] bg-white">
            {model.regularCourses.map((signal, index) => (
              <View key={signal.course.id}>
                <CourseRow
                  signal={signal}
                  onPress={() => router.push(courseRoute(signal.course.id))}
                />
                {index < model.regularCourses.length - 1 ? (
                  <View className="ml-[68px] h-px bg-[#E7EDF4]" />
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <View className="px-1">
    <Text className="text-[20px] leading-7 text-[#435160]" weight="bold">
      {title}
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
      className="min-h-[208px] bg-white p-3"
      haptic="impact"
      onPress={onPress}
      pressedScale={0.985}
      style={styles.featuredBorder}
    >
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-start justify-between gap-2">
          <ExamSlotBadge slot={signal.course.examSlot} elevated />
          <View className="h-10 w-10 items-center justify-center">
            <SubjectIcon subject={signal.course.subject} size={38} />
          </View>
        </View>
        <View className="gap-1">
          <Text
            className="text-[17px] leading-[22px] text-primary-text"
            weight="bold"
            numberOfLines={1}
          >
            {signal.course.name}
          </Text>
          <TeacherLine course={signal.course} />
        </View>
        <View className="h-px bg-[#E7EDF4]" />
        <View className="gap-1">
          <GradeReadout signal={signal} large />
        </View>
        <View className="h-px bg-[#E7EDF4]" />
        <SecondaryGradeSplit signal={signal} />
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
  <View style={styles.compactShadow}>
    <PressableSurface
      accessibilityLabel={courseAccessibilityLabel(signal.course)}
      borderRadius={22}
      className="min-h-[182px] bg-white px-2.5 py-2.5"
      onPress={onPress}
      pressedScale={0.987}
      style={styles.compactBorder}
    >
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-start justify-between gap-1">
          <ExamSlotBadge slot={signal.course.examSlot} />
          <View className="h-8 w-8 justify-center">
            <SubjectIcon subject={signal.course.subject} size={30} />
          </View>
        </View>
        <View className="gap-1">
          <Text className="text-[14px] leading-4 text-primary-text" weight="bold" numberOfLines={1}>
            {signal.course.name}
          </Text>
          <TeacherLine course={signal.course} small />
        </View>
        <View className="h-px bg-[#E7EDF4]" />
        <GradeReadout signal={signal} />
        <View className="h-px bg-[#E7EDF4]" />
        <SecondaryGradeSplit signal={signal} compact />
      </View>
    </PressableSurface>
  </View>
);

const CourseRow = ({ signal, onPress }: { signal: ProfileCourseSignal; onPress: () => void }) => (
  <PressableSurface
    accessibilityLabel={courseAccessibilityLabel(signal.course)}
    borderRadius={0}
    className="bg-white px-4 py-3"
    haptic="selection"
    onPress={onPress}
    pressedScale={1}
  >
    <View className="flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center">
        <SubjectIcon subject={signal.course.subject} size={32} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text
            className="min-w-0 flex-1 text-[16px] leading-5 text-primary-text"
            weight="bold"
            numberOfLines={1}
          >
            {signal.course.name}
          </Text>
          {signal.taskSignal ? <TaskPill label={signal.taskSignal} /> : null}
        </View>
        <TeacherLine course={signal.course} />
      </View>
      <View className="flex-row items-center gap-1.5">
        <CourseGradePill signal={signal} />
        <SystemIcon name="chevron-right" size={18} color="#9AA8B8" />
      </View>
    </View>
  </PressableSurface>
);

const GradeReadout = ({ signal, large }: { signal: ProfileCourseSignal; large?: boolean }) => {
  if (!signal.primaryGrade) {
    return (
      <View className={large ? "h-[50px]" : "h-[43px]"}>
        <View className="h-4" />
        <Text
          className={
            large
              ? "text-[24px] leading-[30px] text-[#AAB4C2]"
              : "text-[22px] leading-7 text-[#AAB4C2]"
          }
          weight="bold"
        >
          --
        </Text>
      </View>
    );
  }

  const label = signal.primaryGrade.label === "Gesamt" ? "Gesamtnote" : signal.primaryGrade.label;

  return (
    <View className={large ? "h-[50px]" : "h-[43px]"}>
      <Text className="text-[12px] leading-4 text-[#3E4C5E]" weight="bold">
        {label}
      </Text>
      <Text
        className={
          large
            ? "text-[24px] leading-[30px] text-primary-text"
            : "text-[22px] leading-7 text-primary-text"
        }
        weight="bold"
      >
        {signal.primaryGrade.value}
      </Text>
    </View>
  );
};

const SecondaryGradeSplit = ({
  signal,
  compact,
}: {
  signal: ProfileCourseSignal;
  compact?: boolean;
}) => {
  const oral = signal.oralGrade ?? "-";
  const written = signal.writtenGrade ?? "-";

  return (
    <View className="flex-row items-center justify-center">
      <GradeMiniColumn label="mdl." value={oral} compact={compact} />
      <View className={compact ? "mx-2 h-7 w-px bg-[#DDE6F1]" : "mx-4 h-8 w-px bg-[#DDE6F1]"} />
      <GradeMiniColumn label="schr." value={written} compact={compact} />
    </View>
  );
};

const GradeMiniColumn = ({
  compact,
  label,
  value,
}: {
  compact?: boolean;
  label: string;
  value: string;
}) => (
  <View className="min-w-0 flex-1 items-center">
    <Text
      className={
        compact ? "text-[11px] leading-4 text-[#5B6472]" : "text-[13px] leading-5 text-[#5B6472]"
      }
      numberOfLines={1}
    >
      {label}
    </Text>
    <Text
      className={
        compact
          ? "text-[13px] leading-4 text-primary-text"
          : "text-[15px] leading-5 text-primary-text"
      }
      weight="medium"
    >
      {value}
    </Text>
  </View>
);

const TeacherLine = ({ course, small }: { course: Course; small?: boolean }) => (
  <View className="min-w-0 flex-row items-center gap-1.5">
    <SystemIcon name="person" size={small ? 14 : 17} color="#7F8A97" />
    <Text
      className={
        small
          ? "min-w-0 flex-1 text-[11px] leading-4 text-[#5B6472]"
          : "min-w-0 flex-1 text-[13px] leading-[18px] text-[#5B6472]"
      }
      numberOfLines={1}
    >
      {courseTeacherLabel(course)}
    </Text>
  </View>
);

const EncouragementCard = () => (
  <PressableSurface
    accessibilityLabel="Stark, weiter so"
    borderRadius={22}
    className="flex-row items-center gap-3 bg-[#EAF3FF] px-4 py-3.5"
    haptic="selection"
    pressedScale={0.99}
  >
    <View className="h-10 w-10 items-center justify-center rounded-full bg-[#D7E9FF]">
      <SystemIcon name="verified" size={23} color={colors.accent.DEFAULT} />
    </View>
    <View className="min-w-0 flex-1">
      <Text className="text-[16px] leading-5 text-[#1269C8]" weight="bold">
        Stark!
      </Text>
      <Text className="text-[14px] leading-5 text-[#214D83]" numberOfLines={1}>
        Weiter so - du machst das super!
      </Text>
    </View>
    <SystemIcon name="chevron-right" size={20} color={colors.accent.DEFAULT} />
  </PressableSurface>
);

const CourseGradePill = ({ signal }: { signal: ProfileCourseSignal }) => (
  <View className="items-center justify-center rounded-full bg-primary px-3 py-1">
    <Text className="text-[13px] leading-4 text-white" weight="bold">
      {signal.primaryGrade?.value ?? "--"}
    </Text>
  </View>
);

const TaskPill = ({ label }: { label: string }) => (
  <View className="rounded-full bg-alert-des px-2 py-0.5">
    <Text className="text-[11px] leading-4 text-[#8A6500]" weight="bold" numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const ExamSlotBadge = ({ slot, elevated }: { slot?: string; elevated?: boolean }) => {
  if (!slot) {
    return null;
  }

  return (
    <View
      className="self-start items-center justify-center rounded-full px-2.5"
      style={{
        backgroundColor: colors.primary.text,
        minHeight: elevated ? 30 : 26,
      }}
    >
      <Text
        className={
          elevated ? "text-[13px] leading-4 text-white" : "text-[12px] leading-4 text-white"
        }
        weight="bold"
      >
        {slot}
      </Text>
    </View>
  );
};

const courseTeacherLabel = (course: Course) =>
  course.teachers.map((teacher) => Teacher.formalNameShort(teacher)).join(", ");

const courseAccessibilityLabel = (course: Course) =>
  `${course.examSlot ? `${course.examSlot}, ` : ""}${subjectNameMap[course.subject]}, ${
    course.name
  }`;

const styles = StyleSheet.create({
  featuredBorder: {
    borderColor: "rgba(121, 145, 174, 0.16)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  compactBorder: {
    borderColor: "rgba(121, 145, 174, 0.16)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  featuredShadow: {
    borderRadius: 28,
    boxShadow: Platform.OS === "web" ? "0px 6px 16px rgba(32, 55, 85, 0.045)" : undefined,
    elevation: Platform.OS === "android" ? 1 : 0,
    shadowColor: "#203755",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: Platform.OS === "ios" ? 0.045 : 0,
    shadowRadius: 10,
  },
  compactShadow: {
    borderRadius: 22,
    boxShadow: Platform.OS === "web" ? "0px 4px 12px rgba(32, 55, 85, 0.035)" : undefined,
    elevation: 0,
    shadowColor: "#203755",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === "ios" ? 0.035 : 0,
    shadowRadius: 8,
  },
});
