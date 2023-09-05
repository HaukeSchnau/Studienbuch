import { useMemo } from "react";

import { type Course, type User } from "@acme/db";

import { api } from "~/utils/api";
import { CourseCard } from "./CourseCard";
import { LoadingIndicator } from "./LoadingIndicator";

type CourseListProps = {
  yearId: number;
};

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
    <ul className="grid gap-10">
      {courses.map((course) => (
        <CourseCard
          key={course.id}
          course={
            course as unknown as Omit<
              Course,
              "createdAt" | "updatedAt" | "room"
            > & {
              teacher: User;
            } // TODO make this better
          }
        />
      ))}

      <style jsx>{`
        .grid {
          grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
        }
      `}</style>
    </ul>
  );
};
