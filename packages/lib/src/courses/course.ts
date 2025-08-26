import type { Salutation } from "../teacher";
import type { SubjectId } from "./subject";

export interface Course {
  id: string;
  name: string;
  subject: SubjectId;
  isMandatory: boolean;
}

export interface WithTeachers {
  teachers: {
    id: string;
    firstName: string;
    lastName: string;
    abbrv: string | null;
    salutation: Salutation | null;
  }[];
}

export interface RecurringCourseTime {
  duration: number;
  start: number;
  weekday: number;
  weeks: CourseTimeWeeks;
}

export type CourseTimeWeeks = "EVEN" | "ODD" | "BOTH";
