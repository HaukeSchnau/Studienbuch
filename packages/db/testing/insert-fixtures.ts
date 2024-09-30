import * as schema from "@stu/db/schema";

import type { Client } from "./client";
import { personFixtures } from "./fixtures";
import { userFixtures } from "./fixtures/users";

export const insertFixtures = async (db: Client) => {
  await db.insert(schema.Persons).values(personFixtures);
  await db.insert(schema.Users).values(userFixtures);
};
