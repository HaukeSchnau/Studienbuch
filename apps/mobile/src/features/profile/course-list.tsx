import { useRouter } from "expo-router";
import { View } from "react-native";
import { Card } from "~/components/ui/card";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import { Table } from "~/components/layout/table";
import { Text } from "~/components/ui/text";
import type { Semester } from "@stu/core";
import { subjectNameMap } from "@stu/core";
import { useCourses } from "~/data/hooks";
import { courseRoute } from "~/routing/params";

export const CourseList = ({ semester }: { semester: Semester }) => {
  const { getSemesterCourses } = useCourses();
  const courses = getSemesterCourses(semester.id);
  const router = useRouter();

  return (
    <Table
      items={courses}
      getKey={(course) => course.id}
      gap={16}
      render={(course) => (
        <Card padding="sm" onPress={() => router.push(courseRoute(course.id))}>
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
