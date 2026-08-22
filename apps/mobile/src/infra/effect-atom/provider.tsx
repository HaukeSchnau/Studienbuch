import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { coursesAtom, selectedCourseIdsBySemesterAtom } from "~/features/courses/course-atoms";
import {
  schoolClassesAtom,
  schoolYearsAtom,
  semestersAtom,
} from "~/features/organization/catalog-atoms";
import { profileAtom } from "~/features/profile/profile-atoms";
import { holidaysAtom, timetableAtom } from "~/features/schedule/schedule-atoms";
import { taskIdFactoryAtom, tasksAtom } from "~/features/tasks/task-atoms";
import { coursesSeed, selectedCourseIdsBySemesterSeed } from "~/infra/mock-data/courses";
import { createMockId } from "~/infra/mock-data/id";
import { profileSeed } from "~/infra/mock-data/profile";
import { holidaysSeed, timetableSeed } from "~/infra/mock-data/schedule";
import { classes, semesters, years } from "~/infra/mock-data/school-catalog";
import { tasksSeed } from "~/infra/mock-data/tasks";

const initialValues = [
  [schoolYearsAtom, years],
  [schoolClassesAtom, classes],
  [semestersAtom, semesters],
  [coursesAtom, coursesSeed],
  [selectedCourseIdsBySemesterAtom, selectedCourseIdsBySemesterSeed],
  [profileAtom, profileSeed],
  [timetableAtom, timetableSeed],
  [holidaysAtom, holidaysSeed],
  [tasksAtom, tasksSeed],
  [taskIdFactoryAtom, { create: () => createMockId("task") }],
] as const;

export function EffectAtomProvider({ children }: PropsWithChildren) {
  return <RegistryProvider initialValues={initialValues}>{children}</RegistryProvider>;
}
