import { getVisibleTimetable, type Holiday, type TimetableEntry } from "~/compat/mobile-v0";
import { coursesAtom, selectedCourseIdsBySemesterAtom } from "~/features/courses";
import { Atom } from "effect/unstable/reactivity";

export const timetableAtom = Atom.make<TimetableEntry[]>([]).pipe(
  Atom.keepAlive,
  Atom.withLabel("schedule:timetable"),
);

export const holidaysAtom = Atom.make<Holiday[]>([]).pipe(
  Atom.keepAlive,
  Atom.withLabel("schedule:holidays"),
);

export const visibleTimetableAtom = Atom.make((context) =>
  getVisibleTimetable(
    context.get(timetableAtom),
    context.get(coursesAtom),
    context.get(selectedCourseIdsBySemesterAtom),
  ),
).pipe(Atom.withLabel("schedule:visible-timetable"));
