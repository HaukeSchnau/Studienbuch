import { test } from "vitest";

import { db } from "@acme/db";

import { appRouter } from "../src/root";

test("sync", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caller = appRouter.createCaller({
    db,
    session: null,
  });

  // TODO
  // expect(await caller.sync({}));
});
