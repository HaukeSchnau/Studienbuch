import { expect, test } from "vitest";

import { prisma } from "@acme/db";

import { appRouter } from "../src/root";

const randomizeIds = <T extends { id: number }>(
  items: T[],
): [T[], { originalId: number; fixedId?: number }[]] => {
  const randomized: T[] = [];
  const expectedFixed: { originalId: number; fixedId?: number }[] = [];

  for (const item of items) {
    const randomId = Math.floor(Math.random() * 1000000);

    randomized.push({
      ...item,
      id: randomId,
    });

    expectedFixed.push({
      originalId: randomId,
      fixedId: item.id,
    });
  }

  return [randomized, expectedFixed];
};

test("idFix", async () => {
  const caller = appRouter.createCaller({
    prisma,
    session: null,
  });

  const [randomUsers, expectedFixedUsers] = randomizeIds(
    await prisma.user.findMany({}),
  );
  const [randomCourses, expectedFixedCourses] = randomizeIds(
    await prisma.course.findMany({
      where: {
        year: {
          name: {
            not: "Hans",
          },
        },
      },
    }),
  );

  const res = await caller.idFix({
    courses: randomCourses,
    users: randomUsers,
  });

  expect(res.fixedUsers).toEqual(expectedFixedUsers);
  expect(res.fixedCourses).toEqual(expectedFixedCourses);
});
