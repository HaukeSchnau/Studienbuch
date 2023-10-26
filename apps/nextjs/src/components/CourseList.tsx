import { useMemo } from "react";

import type { Course } from "@acme/common";

import { api } from "~/utils/api";
import { CourseCard } from "./CourseCard";
import { LoadingIndicator } from "./LoadingIndicator";

interface CourseListProps {
  yearId: number;
}

export const CourseList = ({ yearId }: CourseListProps) => {
  const { isLoading, error, data } = api.courses.get.useQuery({ yearId });

  const sortedCourses = useMemo(() => {
    if (!data) return null;

    return data.slice().sort((a, b) => a.courseId.localeCompare(b.courseId));
  }, [data]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const courses = sortedCourses ?? data;

  return (
    <ul
      className="grid gap-10"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
      }}
    >
      {courses.map((course) => (
        <CourseCard
          key={course.id}
          course={
            course as Course // TODO make this better
          }
        />
      ))}
    </ul>
  );
};
