import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Persons } from "@stu/db/schema";
import {
  findAbbrvName,
  loginIservWithDefaultCredentials,
} from "@stu/external-api";

export const addNamesToExistingUsers = async () => {
  const parsedUsers = await db
    .select()
    .from(Persons)
    .where(eq(Persons.name, Persons.abbrv));

  for (const user of parsedUsers) {
    if (!user.abbrv) throw new Error("User has no abbreviation");
    const makeRequest = await loginIservWithDefaultCredentials();
    const result = await findAbbrvName(makeRequest, user.abbrv);
    if (!result) {
      console.error(`Could not find name for abbreviation "${user.abbrv}"`);
      continue;
    }

    await db
      .update(Persons)
      .set({
        name: result.name,
        email: result.email,
      })
      .where(eq(Persons.id, user.id));
  }
};
