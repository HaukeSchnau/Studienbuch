import { expect, test } from "vitest";

import { prisma } from "@acme/db";

import { appRouter } from "../src/root";

test("sync", async () => {
  const caller = appRouter.createCaller({
    prisma,
    session: null,
  });
  
  // TODO
  // expect(await caller.sync({}));

});
