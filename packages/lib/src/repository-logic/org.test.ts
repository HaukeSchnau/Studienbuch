import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";
import { createSemestersCore, schoolRepositoryLogic } from "./org";

describe("schoolRepositoryLogic", () => {
  test("doesSchoolExist returns true when getSchool returns a school", async () => {
    const getSchool = vi.fn(() => Effect.succeed({ id: "igs-lil", name: "IGS Lilienthal", stateCode: "NI" as const }));

    const repository = schoolRepositoryLogic({
      getSchool,
      insertSchool: vi.fn(() => Effect.void),
      getSchoolsByState: vi.fn(() => Effect.succeed([])),
    });

    const result = await Effect.runPromise(repository.doesSchoolExist({ id: "igs-lil" }));

    expect(result).toBe(true);
    expect(getSchool).toHaveBeenCalledWith({ id: "igs-lil" });
  });

  test("doesSchoolExist returns false when getSchool returns undefined", async () => {
    const getSchool = vi.fn(() => Effect.succeed(undefined));

    const repository = schoolRepositoryLogic({
      getSchool,
      insertSchool: vi.fn(() => Effect.void),
      getSchoolsByState: vi.fn(() => Effect.succeed([])),
    });

    const result = await Effect.runPromise(repository.doesSchoolExist({ id: "igs-lil" }));

    expect(result).toBe(false);
    expect(getSchool).toHaveBeenCalledWith({ id: "igs-lil" });
  });

  test("createSchoolCore delegates to insertSchool", async () => {
    const insertSchool = vi.fn(() => Effect.void);

    const repository = schoolRepositoryLogic({
      getSchool: vi.fn(() => Effect.succeed(undefined)),
      insertSchool,
      getSchoolsByState: vi.fn(() => Effect.succeed([])),
    });

    await Effect.runPromise(
      repository.createSchoolCore({
        id: "igs-lil",
        name: "IGS Lilienthal",
        state: "NI",
      }),
    );

    expect(insertSchool).toHaveBeenCalledWith({
      id: "igs-lil",
      name: "IGS Lilienthal",
      state: "NI",
    });
  });
});

describe("createSemestersCore", () => {
  test("maps simple dates to dates and delegates to upsertSemesters", async () => {
    const convertDate = vi.fn(
      (date: { year: number; month: number; day: number }) => new Date(Date.UTC(date.year, date.month - 1, date.day)),
    );
    const upsertSemesters = vi.fn(() => Effect.void);

    const createSemesters = createSemestersCore({
      convertDate,
      upsertSemesters,
    });

    const payload = [
      {
        name: "Winter 2025/2026",
        start: { year: 2025, month: 9, day: 1 },
        end: { year: 2026, month: 1, day: 31 },
        type: "WINTER" as const,
        year: 2025,
        school: "igs-lil",
      },
    ];
    const winter = payload[0]!;

    await Effect.runPromise(createSemesters(payload));

    expect(convertDate).toHaveBeenCalledTimes(2);
    expect(convertDate).toHaveBeenNthCalledWith(1, winter.start);
    expect(convertDate).toHaveBeenNthCalledWith(2, winter.end);
    expect(upsertSemesters).toHaveBeenCalledWith([
      {
        ...winter,
        start: new Date(Date.UTC(2025, 8, 1)),
        end: new Date(Date.UTC(2026, 0, 31)),
      },
    ]);
  });

  test("passes through all semesters in order", async () => {
    const upsertSemesters = vi.fn(() => Effect.void);
    const createSemesters = createSemestersCore({
      convertDate: (date) => new Date(Date.UTC(date.year, date.month - 1, date.day)),
      upsertSemesters,
    });

    const payload = [
      {
        name: "Winter 2024/2025",
        start: { year: 2024, month: 9, day: 1 },
        end: { year: 2025, month: 1, day: 31 },
        type: "WINTER" as const,
        year: 2024,
        school: "igs-lil",
      },
      {
        name: "Sommer 2025",
        start: { year: 2025, month: 2, day: 1 },
        end: { year: 2025, month: 7, day: 31 },
        type: "SUMMER" as const,
        year: 2025,
        school: "igs-lil",
      },
    ];
    const winter = payload[0]!;
    const summer = payload[1]!;

    await Effect.runPromise(createSemesters(payload));

    expect(upsertSemesters).toHaveBeenCalledWith([
      {
        ...winter,
        start: new Date(Date.UTC(2024, 8, 1)),
        end: new Date(Date.UTC(2025, 0, 31)),
      },
      {
        ...summer,
        start: new Date(Date.UTC(2025, 1, 1)),
        end: new Date(Date.UTC(2025, 6, 31)),
      },
    ]);
  });
});
