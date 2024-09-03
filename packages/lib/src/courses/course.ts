import type { Teacher } from "../users";
import type { SubjectId } from "./subject";

export interface Course {
  id: number;
  courseId: string;
  name: SubjectId;
  teacher: Teacher;
  isChoosable: boolean;
  times: CourseTime[];
}

export type CourseWithoutTimes = Omit<Course, "times">;

export interface CourseTime {
  duration: number;
  start: number;
  weekday: number;
  weeks: CourseTimeWeeks;
}

export type CourseTimeWeeks = "EVEN" | "ODD" | "BOTH";
