import type { Course, TimetableEntry } from "~/compat/mobile-v0";
import { coursesAtom, selectedCourseIdsBySemesterAtom } from "~/features/courses";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vite-plus/test";
import { timetableAtom, visibleTimetableAtom } from "./schedule-atoms";

const courses: Course[] = [
  {
    id: "course-selected",
    name: "Selected",
    subject: "ma",
    teachers: [],
    semesterId: "semester-1",
  },
  {
    id: "course-hidden",
    name: "Hidden",
    subject: "de",
    teachers: [],
    semesterId: "semester-1",
  },
];

const timetable: TimetableEntry[] = courses.map((course, index) => ({
  id: `entry-${index}`,
  courseId: course.id,
  start: new Date(`2026-08-${24 + index}T08:00:00.000Z`),
  duration: 80,
}));

describe("schedule atoms", () => {
  it("reacts to the selected courses without changing the raw timetable", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [coursesAtom, courses],
        [selectedCourseIdsBySemesterAtom, { "semester-1": ["course-selected"] }],
        [timetableAtom, timetable],
      ],
    });

    expect(registry.get(visibleTimetableAtom).map((entry) => entry.courseId)).toEqual([
      "course-selected",
    ]);

    registry.set(selectedCourseIdsBySemesterAtom, { "semester-1": ["course-hidden"] });

    expect(registry.get(visibleTimetableAtom).map((entry) => entry.courseId)).toEqual([
      "course-hidden",
    ]);
    expect(registry.get(timetableAtom)).toEqual(timetable);
    registry.dispose();
  });
});
