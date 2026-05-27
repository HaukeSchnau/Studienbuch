import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { Stack } from "expo-router";
import { View } from "react-native";
import { CoreLayout } from "~/components/core-layout";
import { SubjectIcon } from "~/components/subject-icon";
import { Text } from "~/components/text";
import { shadow } from "~/components/styles/shadow";
import { subjectNameMap, Teacher } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
import { GradesOverviewCard } from "./grades/grades-overview-card";
import { Tasks } from "~/features/tasks/tasks";

export const CoursePage = ({ courseId }: { courseId: string }) => {
  const { getCourse, semesters } = useMockApp();
  const course = getCourse(courseId);

  if (!course) {
    return null;
  }

  const semester = semesters.find((item) => item.id === course.semesterId)!;

  return (
    <CoreLayout>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
        }}
      />
      <View className="px-8">
        <View className="flex-row justify-between">
          <View>
            <View className="h-12" />
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

          <View
            className="aspect-square h-28 items-center justify-center rounded-2xl bg-white"
            style={shadow}
          >
            <SubjectIcon subject={course.subject} size={52} />
          </View>
        </View>

        <View className="h-8" />
        <GradesOverviewCard courseId={course.id} />
      </View>
      <View className="h-8" />
      <Tasks courseId={course.id} />
    </CoreLayout>
  );
};
