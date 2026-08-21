import type { Course } from "~/compat/mobile-v0";
import { Atom } from "effect/unstable/reactivity";

export type SelectedCourseIdsBySemester = Record<string, string[]>;

export interface SetSelectedCoursesInput {
  readonly semesterId: string;
  readonly courseIds: string[];
}

export const coursesAtom = Atom.make<Course[]>([]).pipe(
  Atom.keepAlive,
  Atom.withLabel("courses:all"),
);

export const selectedCourseIdsBySemesterAtom = Atom.make<SelectedCourseIdsBySemester>({}).pipe(
  Atom.keepAlive,
  Atom.withLabel("courses:selected-by-semester"),
);

export const setSelectedCoursesAtom = Atom.writable(
  () => undefined,
  (context, { semesterId, courseIds }: SetSelectedCoursesInput) => {
    context.set(selectedCourseIdsBySemesterAtom, {
      ...context.get(selectedCourseIdsBySemesterAtom),
      [semesterId]: courseIds,
    });
  },
).pipe(Atom.withLabel("courses:set-selected"));
