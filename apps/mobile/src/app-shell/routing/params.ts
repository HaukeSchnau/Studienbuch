import type { GradeType } from "@stu/core";

type RouteParam = string | string[] | undefined;
const gradeTypes = new Set<GradeType>(["MASTER", "ORAL", "WRITTEN"]);

const firstParam = (value: RouteParam) => (Array.isArray(value) ? value[0] : value);
const parseGradeType = (value: string | undefined) =>
  value && gradeTypes.has(value as GradeType) ? (value as GradeType) : undefined;

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
