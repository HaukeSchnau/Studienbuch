import { db } from "@stu/db/client";
import { Persons, Users } from "@stu/db/schema";
import type { Salutation } from "@stu/lib";

import { hashPassword } from "../auth";

export const createUser = async ({
  firstName,
  lastName,
  email,
  password,
  salutation,
  abbrv,
}: {
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  salutation?: Salutation;
  abbrv?: string;
}) => {
  const hashedPassword = password ? await hashPassword(password) : undefined;

  const personId = await db
    .insert(Persons)
    .values({
      firstName,
      lastName,
      salutation,
      abbrv,
      email,
    })
    .returning({
      id: Persons.id,
    })
    // biome-ignore lint/style/noNonNullAssertion: TODO
    .then((rows) => rows[0]!.id);

  await db.insert(Users).values({
    email: email?.toLowerCase(),
    passwordHash: hashedPassword,
    id: personId,
  });
};
