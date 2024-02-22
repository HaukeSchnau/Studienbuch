import { test } from "vitest";

import { db } from "@schnau/db";

import { appRouter } from "../src";

test("sync", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caller = appRouter.createCaller({
    db,
    session: null,
  });

  // TODO
  // expect(await caller.sync({}));
});
