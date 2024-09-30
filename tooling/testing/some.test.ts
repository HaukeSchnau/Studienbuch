import { expect, test } from "vitest";

import { db } from "@stu/db/client";

test("should pass", async () => {
  console.log(await db.query.Persons.findMany());
  expect(1 + 1).toBe(2);
});
