import bcrypt from "bcrypt";

const generatePassword = () => {
    return Math.random().toString(36).slice(-8)
}

const SALT_ROUNDS = 10;

export const hashPassword = (password: string) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const generateHashedPassword = () => {
    return hashPassword(generatePassword())
}
