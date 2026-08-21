import type { SchoolClass, Semester, Year } from "~/compat/mobile-v0";
import { Atom } from "effect/unstable/reactivity";

export const schoolYearsAtom = Atom.make<Year[]>([]).pipe(
  Atom.keepAlive,
  Atom.withLabel("organization:school-years"),
);

export const schoolClassesAtom = Atom.make<SchoolClass[]>([]).pipe(
  Atom.keepAlive,
  Atom.withLabel("organization:school-classes"),
);

export const semestersAtom = Atom.make<Semester[]>([]).pipe(
  Atom.keepAlive,
  Atom.withLabel("organization:semesters"),
);
