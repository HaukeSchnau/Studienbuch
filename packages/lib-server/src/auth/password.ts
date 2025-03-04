import bcrypt from "bcryptjs";

export const checkPassword = (password: string, hashedPassword: string) => {
  return bcrypt.compare(password, hashedPassword);
};

const SALT_ROUNDS = 10;

export const hashPassword = (password: string) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};
