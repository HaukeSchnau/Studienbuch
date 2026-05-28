import { useRouter } from "expo-router";
import { View } from "react-native";
import { Card } from "~/components/card";
import { SubjectIcon } from "~/components/subject-icon";
import { Table } from "~/components/table";
import { Text } from "~/components/text";
import type { Semester } from "~/mock-app/domain";
import { subjectNameMap } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";

export const CourseList = ({ semester }: { semester: Semester }) => {
  const { getSemesterCourses } = useMockApp();
  const courses = getSemesterCourses(semester.id);
  const router = useRouter();

  return (
    <Table
      items={courses}
      getKey={(course) => course.id}
      gap={16}
      render={(course) => (
        <Card
          style={{ padding: 20 }}
          onPress={() =>
            router.push({
              pathname: "/courses/[course]",
              params: { course: course.id },
            })
          }
        >
          <View className="items-center">
            <SubjectIcon subject={course.subject} />
            <View className="h-1.5" />
            <Text weight="bold" className="text-[15px]">
              {subjectNameMap[course.subject]}
            </Text>
          </View>
        </Card>
      )}
    />
  );
};
