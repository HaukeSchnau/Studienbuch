import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";
import { applyOrgSchoolFounded, verifyOrgCoursesCreated, verifyOrgSchoolFounded } from "./org-event-logic";
import { CourseRepository, SchoolRepository } from "./repositories";

describe("org-event-logic", () => {
  test("verifyOrgSchoolFounded fails when school already exists", async () => {
    const error = await Effect.runPromise(
      verifyOrgSchoolFounded({
        data: {
          id: "igs-lil",
          name: "IGS Lilienthal",
          state: "ni",
        } as never,
        onDuplicate: () => new Error("duplicate school"),
      }).pipe(
        Effect.provideService(SchoolRepository, {
          doesSchoolExist: () => Effect.succeed(true),
          getSchool: () => Effect.succeed(undefined),
          createSchool: () => Effect.void,
          getSchoolsByState: () => Effect.succeed([]),
        }),
        Effect.flip,
      ),
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("duplicate school");
  });

  test("applyOrgSchoolFounded forwards payload to SchoolRepository.createSchool", async () => {
    const createSchool = vi.fn(() => Effect.void);

    await Effect.runPromise(
      applyOrgSchoolFounded({
        data: {
          id: "igs-lil",
          name: "IGS Lilienthal",
          state: "ni",
        } as never,
      }).pipe(
        Effect.provideService(SchoolRepository, {
          doesSchoolExist: () => Effect.succeed(false),
          getSchool: () => Effect.succeed(undefined),
          createSchool,
          getSchoolsByState: () => Effect.succeed([]),
        }),
      ),
    );

    expect(createSchool).toHaveBeenCalledWith({
      id: "igs-lil",
      name: "IGS Lilienthal",
      state: "ni",
    });
  });

  test("verifyOrgCoursesCreated uses duplicate check via doesCourseExist", async () => {
    const doesCourseExist = vi.fn(() => Effect.succeed(true));
    const getCourse = vi.fn(() => Effect.succeed(undefined));

    const error = await Effect.runPromise(
      verifyOrgCoursesCreated({
        data: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Deutsch",
          subject: "DE",
          isMandatory: true,
          school: "igs-lil",
          semester: { type: "WINTER", year: 2026 },
          classes: [{ identifierInYear: "Q1", startYear: 2025 }],
          teachers: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        } as never,
        onDuplicate: () => new Error("duplicate course"),
      }).pipe(
        Effect.provideService(CourseRepository, {
          doesCourseExist,
          getCourse,
          createCourse: () => Effect.void,
        }),
        Effect.flip,
      ),
    );

    expect(error).toBeInstanceOf(Error);
    expect(doesCourseExist).toHaveBeenCalledTimes(1);
    expect(getCourse).not.toHaveBeenCalled();
  });
});
