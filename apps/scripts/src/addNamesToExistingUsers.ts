import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { User } from "@stu/db/schema";
import {
  findAbbrvName,
  loginIservWithDefaultCredentials,
} from "@stu/external-api";

export const addNamesToExistingUsers = async () => {
  const parsedUsers = await db
    .select()
    .from(User)
    .where(eq(User.name, User.abbrv));

  for (const user of parsedUsers) {
    if (!user.abbrv) throw new Error("User has no abbreviation");
    const makeRequest = await loginIservWithDefaultCredentials();
    const result = await findAbbrvName(makeRequest, user.abbrv);
    if (!result) {
      console.error(`Could not find name for abbreviation "${user.abbrv}"`);
      continue;
    }

    await db
      .update(User)
      .set({
        name: result.name,
        email: result.email,
      })
      .where(eq(User.id, user.id));
  }
};
