import type { Persons } from "@stu/db/schema";

import { makeId } from "./utils";

export const personFixtures: (typeof Persons.$inferInsert)[] = [
  {
    id: makeId(0),
    name: "John Doe",
    abbrv: "JD",
    email: "john.doe@example.com",
    salutation: "Herr",
  },
];
