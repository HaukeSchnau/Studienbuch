import { describe, expect, it, vi } from "vitest";
import { createSnapshotResolver } from "./snapshot-resolver";

describe("createSnapshotResolver", () => {
  it("deduplicates requested entity ids by kind before loading", async () => {
    const loadStudents = vi.fn(async () => [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        firstName: "Ada",
        lastName: "Student",
        isOfAge: false,
        school: {
          id: "igs-lil" as const,
          name: "IGS Lilienthal",
          stateCode: "NI" as const,
        },
        year: {
          name: "11",
          startYear: 2024,
          graduationYear: 2027,
          school: "igs-lil" as const,
        },
        class: {
          identifierInYear: "11a",
          startYear: 2024,
          school: "igs-lil" as const,
        },
      },
    ]);
    const loadCourses = vi.fn(async () => [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        name: "Mathe LK",
        subject: "ma" as const,
        isMandatory: false,
        school: {
          id: "igs-lil" as const,
          name: "IGS Lilienthal",
          stateCode: "NI" as const,
        },
        semester: {
          name: "Winter 2025/2026",
          start: "2025-08-01T00:00:00.000Z",
          end: "2026-01-31T23:59:59.000Z",
          school: "igs-lil" as const,
          type: "WINTER" as const,
          year: 2025,
        },
        teachers: [],
        classes: [],
      },
    ]);

    const resolve = createSnapshotResolver({
      loadStudents,
      loadCourses,
    });

    const response = await resolve({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      request: {
        entities: [
          { kind: "student", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
          { kind: "student", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
          { kind: "course", id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
          { kind: "course", id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
        ],
      },
    });

    expect(loadStudents).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
    expect(loadCourses).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ]);
    expect(response.students).toHaveLength(1);
    expect(response.courses).toHaveLength(1);
  });

  it("returns empty arrays when no entities of a kind are requested", async () => {
    const loadStudents = vi.fn(async () => []);
    const loadCourses = vi.fn(async () => []);

    const resolve = createSnapshotResolver({
      loadStudents,
      loadCourses,
    });

    const response = await resolve({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      request: {
        entities: [{ kind: "student", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
      },
    });

    expect(loadStudents).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
    expect(loadCourses).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", []);
    expect(response.courses).toEqual([]);
  });
});
