import { useRouter } from "expo-router";
import { NativeFieldGroup, NativeFieldRow, NativeFieldSection } from "~/components/native";
import type { Semester } from "@stu/core";
import { subjectNameMap } from "@stu/core";
import { useCourses } from "~/data/hooks";
import { courseRoute } from "~/routing/params";

export const CourseList = ({ semester }: { semester: Semester }) => {
  const { getSemesterCourses } = useCourses();
  const courses = getSemesterCourses(semester.id);
  const router = useRouter();

  return (
    <NativeFieldGroup>
      <NativeFieldSection title="Kurse">
        {courses.map((course) => (
          <NativeFieldRow
            key={course.id}
            title={subjectNameMap[course.subject]}
            subtitle={course.name}
            onPress={() => router.push(courseRoute(course.id))}
          />
        ))}
      </NativeFieldSection>
    </NativeFieldGroup>
  );
};
