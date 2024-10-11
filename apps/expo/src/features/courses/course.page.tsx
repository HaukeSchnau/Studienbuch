import { View } from "react-native";
import { Stack } from "expo-router";
import { format } from "date-fns";
import { de } from "date-fns/locale";

import { formalName } from "@stu/lib";

import { CoreLayout } from "~/components/core-layout";
import { shadow } from "~/components/styles/shadow";
import { SubjectIcon } from "~/components/subject-icon";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import { GradesOverviewCard } from "./grades/grades-overview-card";

export const CoursePage = ({ courseId }: { courseId: string }) => {
  const courseQuery = api.students.courses.getOne.useQuery({ id: courseId });

  if (!courseQuery.data) {
    return (
      <Stack.Screen
        options={{
          headerTitle: "",
          headerTransparent: true,
          headerStyle: {
            backgroundColor: "transparent",
          },
        }}
      />
    );
  }

  const course = courseQuery.data;

  return (
    <CoreLayout>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerTransparent: true,
          headerStyle: {
            backgroundColor: "transparent",
          },
        }}
      />

      <View className="px-8">
        <View className="flex-row justify-between">
          <View>
            <View className="h-12" />
            <Text weight="bold" className="text-4xl text-white">
              {course.longName}
            </Text>
            <Text className="text-2xl text-white">
              {course.teachers.map(formalName).join(", ")}
            </Text>
            <View className="h-2"></View>
            <Text italic className="text-lg text-white">
              {course.semester.name}
            </Text>
            <Text italic className="text-lg text-white">
              {format(course.semester.start, "MMMM yyyy", { locale: de })} -{" "}
              {format(course.semester.end, "MMMM yyyy", { locale: de })}
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
    </CoreLayout>
  );
};
