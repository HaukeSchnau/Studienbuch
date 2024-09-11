import type { Salutation } from "../users";
import type { SubjectId } from "./subject";

export interface Course {
  id: string;
  name: string;
  subject: SubjectId;
  isMandatory: boolean;
  teachers: {
    id: string;
    name: string;
    abbrv: string | null;
    salutation: Salutation | null;
  }[];
}

export type CourseWithoutTimes = Omit<Course, "times">;

export interface CourseTime {
  duration: number;
  start: number;
  weekday: number;
  weeks: CourseTimeWeeks;
}

export type CourseTimeWeeks = "EVEN" | "ODD" | "BOTH";
