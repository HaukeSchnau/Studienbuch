import type { GradeType } from "@stu/core";
import type { Href } from "expo-router";

type RouteParam = string | string[] | undefined;
const gradeTypes = new Set<GradeType>(["MASTER", "ORAL", "WRITTEN"]);

const firstParam = (value: RouteParam) => (Array.isArray(value) ? value[0] : value);
const parseGradeType = (value: string | undefined) =>
  value && gradeTypes.has(value as GradeType) ? (value as GradeType) : undefined;

export const absencesRoute = "/absences" as const satisfies Href;
export const mainProfileRoute = "/profile" as const satisfies Href;
export const profileCoursesRoute = "/profile/courses" as const satisfies Href;
export const profileEditRoute = "/profile/edit" as const satisfies Href;
export const setupClassAndCoursesRoute = "/setup/class-and-courses" as const satisfies Href;
export const setupNameAndYearRoute = "/setup/name-and-year" as const satisfies Href;

export const taskRoute = (taskId: string) => `/tasks/${taskId}` as Href;

export const courseRoute = (courseId: string) =>
  ({
    pathname: "/courses/[course]",
    params: { course: courseId },
  }) satisfies Href;

export const absenceConfirmationRoute = (date: Date, courseIds: string[]) =>
  ({
    pathname: "/absences/[date]/[courses]",
    params: {
      date: date.getTime(),
      courses: courseIds.join(";"),
    },
  }) satisfies Href;

export const gradeRoute = ({
  courseId,
  date,
  type,
}: {
  courseId: string;
  date: Date;
  type: GradeType;
}) =>
  ({
    pathname: "/courses/[course]/grades/[type]/[date]",
    params: {
      course: courseId,
      type,
      date: date.getTime(),
    },
  }) satisfies Href;

export const getTaskRouteParams = (params: { taskId?: RouteParam }) => ({
  taskId: firstParam(params.taskId),
});

export const getCourseRouteParams = (params: { course?: RouteParam }) => ({
  courseId: firstParam(params.course),
});

export const getAbsenceRouteParams = (params: { date?: RouteParam; courses?: RouteParam }) => {
  const dateParam = firstParam(params.date);
  const coursesParam = firstParam(params.courses);
  const timestamp = dateParam ? Number.parseInt(dateParam, 10) : Number.NaN;

  return {
    date: Number.isFinite(timestamp) ? new Date(timestamp) : undefined,
    courseIds: coursesParam ? coursesParam.split(";").filter(Boolean) : [],
  };
};

export const getGradeRouteParams = (params: {
  course?: RouteParam;
  date?: RouteParam;
  type?: RouteParam;
}) => {
  const dateParam = firstParam(params.date);
  const timestamp = dateParam ? Number.parseInt(dateParam, 10) : Number.NaN;

  return {
    courseId: firstParam(params.course),
    date: Number.isFinite(timestamp) ? new Date(timestamp) : undefined,
    type: parseGradeType(firstParam(params.type)),
  };
};
