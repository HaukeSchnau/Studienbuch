import type { Salutation } from "@stu/lib";
import { hashPassword } from "@stu/auth/src/password";
import { db } from "@stu/db/client";
import { Persons, Users } from "@stu/db/schema";

export const createUser = async ({
  name,
  email,
  password,
  salutation,
  abbrv,
}: {
  name: string;
  email?: string;
  password?: string;
  salutation?: Salutation;
  abbrv?: string;
}) => {
  const hashedPassword = password ? await hashPassword(password) : undefined;

  const personId = await db
    .insert(Persons)
    .values({
      name,
      salutation,
      abbrv,
      email,
    })
    .returning({
      id: Persons.id,
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .then((rows) => rows[0]!.id);

  await db.insert(Users).values({
    email: email?.toLowerCase(),
    passwordHash: hashedPassword,
    id: personId,
  });
};
