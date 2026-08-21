import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { Stack } from "expo-router";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { Card } from "~/ui/card";
import { CoreLayout } from "~/ui/layout/core-layout";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import { Text } from "~/ui/text";
import { useTransparentHeaderTopPadding } from "~/ui/use-transparent-header-top-padding";
import { subjectNameMap, Teacher } from "~/compat/mobile-v0";
import { useSchoolCatalog } from "~/features/organization";
import { useCourses } from "../use-courses";
import { TasksSection } from "~/features/tasks";
import { GradesOverviewCard } from "~/features/courses/grades";

export const CourseScreen = ({ courseId }: { courseId: string }) => {
  const { getCourse } = useCourses();
  const { semesters } = useSchoolCatalog();
  const heroStyle = useTransparentHeaderTopPadding();
  const course = getCourse(courseId);

  if (!course) {
    return null;
  }

  const semester = semesters.find((item) => item.id === course.semesterId);

  if (!semester) {
    return null;
  }

  return (
    <CoreLayout>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
        }}
      />
      <Animated.View className="px-8" style={heroStyle}>
        <View className="flex-row justify-between gap-4 pb-4">
          <View className="flex-1 pr-4">
            <Text weight="bold" className="text-4xl text-white">
              {subjectNameMap[course.subject]}
            </Text>
            <Text className="text-2xl text-white">
              {course.teachers.map((teacher) => Teacher.formalName(teacher)).join(", ")}
            </Text>
            <View className="h-2" />
            <Text italic className="text-lg text-white">
              {semester.name}
            </Text>
            <Text italic className="text-lg text-white">
              {format(semester.start, "MMMM yyyy", { locale: de })} -{" "}
              {format(semester.end, "MMMM yyyy", { locale: de })}
            </Text>
          </View>

          <View className="items-end">
            <Card
              padding="none"
              radius="md"
              className="aspect-square h-28 items-center justify-center"
            >
              <SubjectIcon subject={course.subject} size={52} />
            </Card>
          </View>
        </View>
      </Animated.View>
      <View className="px-4">
        <GradesOverviewCard courseId={course.id} />
      </View>
      <View className="h-8" />
      <TasksSection courseId={course.id} />
    </CoreLayout>
  );
};
