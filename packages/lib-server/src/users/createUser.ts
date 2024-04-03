import { db } from "@schnau/db";

import { hashPassword } from "../../../auth/src/password";

export const createUser = async (
  name: string,
  email?: string,
  password?: string,
) => {
  const hashedPassword = password ? await hashPassword(password) : undefined;

  return db.user.create({
    data: {
      email: email?.toLowerCase(),
      name: name,
      passwordHash: hashedPassword,
    },
  });
};
