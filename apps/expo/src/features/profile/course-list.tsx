import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { Semester } from "@stu/lib";

import { Card } from "~/components/card";
import { SubjectIcon } from "~/components/subject-icon";
import { Table } from "~/components/table";
import { TempError } from "~/components/temp-error";
import { Text } from "~/components/text";
import { getMyCoursesForSemester } from "./queries/get-my-courses";

export const CourseList = ({ semester }: { semester: Semester }) => {
  const courses = useQuery(getMyCoursesForSemester(semester));
  const router = useRouter();

  if (courses.isPending) {
    return <ActivityIndicator />;
  }

  if (courses.isError) {
    return <TempError error={courses.error.message} />;
  }

  return (
    <Table
      items={courses.data}
      getKey={(course) => course.id}
      gap={24}
      render={(course) => (
        <Card
          onPress={() =>
            router.push({
              pathname: "/courses/[course]",
              params: {
                course: course.id,
              },
            })
          }
        >
          <View className="items-center">
            <SubjectIcon subject={course.subject} />
            <View className="h-2" />
            <Text weight="bold">{course.longName}</Text>
          </View>
        </Card>
      )}
    />
  );
};
