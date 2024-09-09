import { describe, expect, it } from "vitest";

import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Persons, Users } from "@stu/db/schema";

import { createUser } from "./createUser";

function expectToBeDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined();
}

describe("createUser", () => {
  it("should create a user", async () => {
    await createUser({
      name: "John Doe",
      email: "john.doe@example.com",
      password: "password",
    });

    const [row] = await db
      .select()
      .from(Users)
      .where(eq(Users.email, "john.doe@example.com"))
      .innerJoin(Persons, eq(Users.id, Persons.id));

    expectToBeDefined(row);
    expect(row.persons.name).toEqual("John Doe");
    expect(row.users.email).toEqual("john.doe@example.com");
    expect(row.users.passwordHash).not.toEqual("password"); // should be hashed
  });
});
