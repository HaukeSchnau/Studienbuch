import type { Users } from "@stu/db/schema";

import { makeId } from "./utils";

export const userFixtures: (typeof Users.$inferInsert)[] = [
  {
    id: makeId(0),
    email: "john.doe@example.com",
    isSuperUser: false,
  },
];
