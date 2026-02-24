import { describe, expect, test } from "vitest";
import { mapStudentWithPersonRowToStudent } from "./student";

describe("mapStudentWithPersonRowToStudent", () => {
  test("maps joined student row fields to repository student DTO", () => {
    const result = mapStudentWithPersonRowToStudent({
      person: {
        id: "s-1",
        firstName: "Ada",
        lastName: "Lovelace",
      },
      school: "igs-lil",
      classIdentifier: "Q1",
      startYear: 2024,
      isOfAge: true,
    });

    expect(result).toEqual({
      id: "s-1",
      firstName: "Ada",
      lastName: "Lovelace",
      school: "igs-lil",
      class: {
        identifier: "Q1",
        startYear: 2024,
      },
      isOfAge: true,
    });
  });

  test("defaults null isOfAge to false", () => {
    const result = mapStudentWithPersonRowToStudent({
      person: {
        id: "s-2",
        firstName: "Grace",
        lastName: "Hopper",
      },
      school: "igs-lil",
      classIdentifier: "Q2",
      startYear: 2025,
      isOfAge: null,
    });

    expect(result.isOfAge).toBe(false);
  });
});
