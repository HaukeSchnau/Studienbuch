import type { MakeRequest } from "@stu/external-api";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Persons } from "@stu/db/schema";
import {
  findAbbrvName,
  loginIservWithDefaultCredentials,
} from "@stu/external-api";

export const createLazyIservClient = () => {
  let makeIservRequest: MakeRequest | null = null;

  const lazyFindAbbrv = async (abbrv: string) => {
    makeIservRequest ??= await loginIservWithDefaultCredentials();
    console.log("Making request for " + abbrv);
    return findAbbrvName(makeIservRequest, abbrv);
  };

  const getOrCreateTeacher = async (abbrv: string) => {
    const existingUser = await db.query.Persons.findFirst({
      where: eq(Persons.abbrv, abbrv),
    });

    if (existingUser) {
      return existingUser.id;
    }

    const iservUser = await lazyFindAbbrv(abbrv);

    const [newUser] = await db
      .insert(Persons)
      .values({
        abbrv,
        name: iservUser?.name ?? abbrv,
        email: iservUser?.email,
        role: "TEACHER",
      })
      .returning()
      .execute();

    if (!newUser) {
      throw new Error(`Could not create user for ${abbrv}`);
    }

    return newUser.id;
  };

  return { getOrCreateTeacher };
};
