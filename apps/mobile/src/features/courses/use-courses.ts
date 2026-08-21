import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";
import { getSelectedSemesterCourses } from "~/compat/mobile-v0";
import {
  coursesAtom,
  selectedCourseIdsBySemesterAtom,
  setSelectedCoursesAtom,
  type SetSelectedCoursesInput,
} from "./course-atoms";

export function useCourses() {
  const courses = useAtomValue(coursesAtom);
  const selectedCourseIdsBySemester = useAtomValue(selectedCourseIdsBySemesterAtom);
  const writeSelectedCourses = useAtomSet(setSelectedCoursesAtom);

  const getCourse = useCallback(
    (courseId: string) => courses.find((course) => course.id === courseId),
    [courses],
  );
  const getSemesterCourses = useCallback(
    (semesterId: string) =>
      getSelectedSemesterCourses(courses, semesterId, selectedCourseIdsBySemester),
    [courses, selectedCourseIdsBySemester],
  );
  const setSelectedCourses = useCallback(
    (semesterId: string, courseIds: SetSelectedCoursesInput["courseIds"]) =>
      writeSelectedCourses({ semesterId, courseIds }),
    [writeSelectedCourses],
  );

  return { courses, getCourse, getSemesterCourses, setSelectedCourses };
}

export function useCourseSelection() {
  return useAtomValue(selectedCourseIdsBySemesterAtom);
}
