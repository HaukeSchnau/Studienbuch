import { useRouter } from "expo-router";
import { View } from "react-native";
import { PressableSurface } from "~/ui/feedback/pressable-surface";
import { SystemIcon } from "~/ui/system-icon";
import { Text } from "~/ui/text";
import { colors } from "~/ui/colors";
import { getProfileCoursesModel } from "./profile-model";
import type { Semester } from "~/compat/mobile-v0";
import { useCourses } from "~/features/courses";
import { useGrades } from "~/features/courses/grades";
import { useProfile } from "./use-profile";
import { useTasks } from "~/features/tasks";
import { courseRoute } from "~/infra/routing/params";
import { CompactExamCourseCard, CourseRow, FeaturedExamCourseCard } from "./course-cards";

export const CourseList = ({ semester }: { semester: Semester }) => {
  const { getSemesterCourses } = useCourses();
  const { getCourseGrades } = useGrades();
  const { getCourseTasks } = useTasks();
  const { profile: user } = useProfile();
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
