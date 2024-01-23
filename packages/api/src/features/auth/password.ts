import bcrypt from "bcrypt";

import { db } from "@schnau/db";

export const checkPassword = (password: string, hashedPassword: string) => {
  return bcrypt.compare(password, hashedPassword);
};

const SALT_ROUNDS = 10;

export const hashPassword = (password: string) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

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
