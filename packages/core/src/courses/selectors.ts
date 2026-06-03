import type { Course } from "./model";

export const getSelectedSemesterCourses = (
  courses: Course[],
  semesterId: string,
  selectedCourseIdsBySemester: Record<string, string[]>,
) =>
  courses.filter(
    (course) =>
      course.semesterId === semesterId &&
      (selectedCourseIdsBySemester[semesterId] ?? []).includes(course.id),
  );
