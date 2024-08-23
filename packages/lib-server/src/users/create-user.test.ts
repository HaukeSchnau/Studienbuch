import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { User } from "@stu/db/schema";
import { describe, expect, it } from "vitest";

import { createUser } from "./createUser";

function expectToBeDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined();
}

describe("createUser", () => {
  it("should create a user", async () => {
    await createUser("John Doe", "john.doe@example.com", "password");

    const [user] = await db
      .select()
      .from(User)
      .where(eq(User.email, "john.doe@example.com"));

    expectToBeDefined(user);
    expect(user.name).toEqual("John Doe");
    expect(user.email).toEqual("john.doe@example.com");
    expect(user.passwordHash).not.toEqual("password"); // should be hashed
  });
});
