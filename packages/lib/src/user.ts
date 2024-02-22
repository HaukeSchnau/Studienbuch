import { db } from "@schnau/db";

import { hashPassword } from "./auth/password";

export const createUser = async (
  name: string,
  email: string,
  password: string,
) => {
  const hashedPassword = await hashPassword(password);

  return db.user.create({
    data: {
      email: email.toLowerCase(),
      name: name,
      passwordHash: hashedPassword,
    },
  });
};
