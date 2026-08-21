import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vite-plus/test";
import { selectedCourseIdsBySemesterAtom, setSelectedCoursesAtom } from "./course-atoms";

describe("course atoms", () => {
  it("replaces one semester selection without changing the others", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [
          selectedCourseIdsBySemesterAtom,
          { "semester-1": ["course-1"], "semester-2": ["course-2"] },
        ],
      ],
    });

    registry.set(setSelectedCoursesAtom, {
      semesterId: "semester-2",
      courseIds: ["course-3", "course-4"],
    });

    expect(registry.get(selectedCourseIdsBySemesterAtom)).toEqual({
      "semester-1": ["course-1"],
      "semester-2": ["course-3", "course-4"],
    });
    registry.dispose();
  });
});
