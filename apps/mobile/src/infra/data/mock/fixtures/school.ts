import type { SchoolClass, Semester, Year } from "@/compat/mobile-v0";

export const years: Year[] = [
  { id: "y12", name: "Jahrgang 12", startYear: 2024, classLevel: 12 },
  { id: "y13", name: "Jahrgang 13", startYear: 2023, classLevel: 13 },
];

export const classes: SchoolClass[] = [
  { id: "c12a", identifierInYear: "A", startYear: 2024 },
  { id: "c12b", identifierInYear: "B", startYear: 2024 },
  { id: "c13a", identifierInYear: "A", startYear: 2023 },
];

export const semesters: Semester[] = [
  {
    id: "s1",
    name: "1. Semester",
    start: new Date("2025-08-01T00:00:00"),
    end: new Date("2026-01-31T00:00:00"),
  },
  {
    id: "s2",
    name: "2. Semester",
    start: new Date("2026-02-01T00:00:00"),
    end: new Date("2026-07-31T00:00:00"),
  },
];
