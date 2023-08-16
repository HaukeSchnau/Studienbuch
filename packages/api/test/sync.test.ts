import { test } from "vitest";

import { prisma } from "@acme/db";

import { appRouter } from "../src/root";

test("sync", async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const caller = appRouter.createCaller({
    prisma,
    session: null,
  });
  
  // TODO
  // expect(await caller.sync({}));

});
