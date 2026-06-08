import { useRouter } from "expo-router";
import { View } from "react-native";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { Card } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import type { Semester } from "@stu/core";
import { subjectNameMap, Teacher } from "@stu/core";
import { useCourses } from "~/data/hooks";
import { courseRoute } from "~/routing/params";
import { colors } from "~/theme/colors";

export const CourseList = ({ semester }: { semester: Semester }) => {
  const { getSemesterCourses } = useCourses();
  const courses = getSemesterCourses(semester.id);
  const router = useRouter();

  return (
    <View className="gap-3">
      <View className="flex-row items-end justify-between px-1">
        <Text className="text-[22px] leading-7" weight="bold">
          Kurse
        </Text>
        <Text className="text-[15px] text-neutral">
          {courses.length} {courses.length === 1 ? "Kurs" : "Kurse"}
        </Text>
      </View>

      {courses.length > 0 ? (
        courses.map((course) => (
          <PressableSurface
            key={course.id}
            accessibilityLabel={`${subjectNameMap[course.subject]}, ${course.name}`}
            borderRadius={24}
            haptic="impact"
            onPress={() => router.push(courseRoute(course.id))}
            pressedScale={0.985}
          >
            <Card noShadow padding="none" radius="md" className="bg-white">
              <View className="flex-row items-center gap-4 px-4 py-3.5">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-accent-des">
                  <SubjectIcon subject={course.subject} size={28} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[18px] leading-6" weight="bold" numberOfLines={1}>
                    {subjectNameMap[course.subject]}
                  </Text>
                  <Text className="text-[15px] leading-5 text-[#5B6472]" numberOfLines={1}>
                    {course.name} ·{" "}
                    {course.teachers.map((teacher) => Teacher.formalName(teacher)).join(", ")}
                  </Text>
                </View>
                <View
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: colors.primary.pale }}
                />
              </View>
            </Card>
          </PressableSurface>
        ))
      ) : (
        <Card noShadow padding="md" radius="md">
          <Text className="text-lg" weight="semi-bold">
            Noch keine Kurse
          </Text>
          <Text className="pt-1 text-base text-[#5B6472]">
            Füge deine Fächer in den Einstellungen hinzu.
          </Text>
        </Card>
      )}
    </View>
  );
};
