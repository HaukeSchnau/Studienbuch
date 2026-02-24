import type { Year } from "@stu/lib";

interface CourseListProps {
  year: Year.Id;
}

export const CourseList = (_: CourseListProps) => {
  return <></>;
  // const { isPending, error, data } = api.courses.list.useQuery({ yearId });
  // const sortedCourses = useMemo(() => {
  //   if (!data) return null;
  //   return data.slice().sort((a, b) => a.courseId.localeCompare(b.courseId));
  // }, [data]);
  // if (isPending) {
  //   return <LoadingIndicator />;
  // }
  // if (error) {
  //   return <div>Error: {error.message}</div>;
  // }
  // const courses = sortedCourses ?? data;
  // return (
  //   <Grid
  //     data={courses}
  //     renderItem={(course) => <CourseCard key={course.id} course={course} />}
  //   />
  // );
};
