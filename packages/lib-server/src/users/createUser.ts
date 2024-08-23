import { hashPassword } from "@stu/auth/src/password";
import { db } from "@stu/db/client";
import { User } from "@stu/db/schema";

export const createUser = async (
  name: string,
  email?: string,
  password?: string,
) => {
  const hashedPassword = password ? await hashPassword(password) : undefined;

  await db.insert(User).values({
    email: email?.toLowerCase(),
    name: name,
    passwordHash: hashedPassword,
    updatedAt: new Date(),
  });
};
