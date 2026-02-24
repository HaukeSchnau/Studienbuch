import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";
import { schoolRepositoryLogic } from "./org";

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
