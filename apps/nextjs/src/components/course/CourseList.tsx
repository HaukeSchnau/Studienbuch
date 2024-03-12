import { useMemo } from "react";

import { api } from "~/infrastructure/trpc/react";
import { Grid } from "../layout/Grid";
import { LoadingIndicator } from "../layout/LoadingIndicator";
import { CourseCard } from "./CourseCard";

interface CourseListProps {
  yearId: number;
}

export const CourseList = ({ yearId }: CourseListProps) => {
  const { isPending, error, data } = api.courses.list.useQuery({ yearId });

  const sortedCourses = useMemo(() => {
    if (!data) return null;

    return data.slice().sort((a, b) => a.courseId.localeCompare(b.courseId));
  }, [data]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const courses = sortedCourses ?? data;

  return (
    <Grid
      data={courses}
      renderItem={(course) => <CourseCard course={course} />}
    />
  );
};
