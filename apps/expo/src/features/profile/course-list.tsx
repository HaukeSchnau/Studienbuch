import { View } from "react-native";
import { useRouter } from "expo-router";

import type { Semester } from "@stu/lib";

import { Card } from "~/components/card";
import { SubjectIcon } from "~/components/subject-icon";
import { Table } from "~/components/table";
import { Text } from "~/components/text";
import { api } from "~/utils/api";

export const CourseList = ({ semester }: { semester: Semester }) => {
  const courses = api.students.courses.getForSemester.useQuery({ semester });
  const router = useRouter();

  if (!courses.data) {
    return null;
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
