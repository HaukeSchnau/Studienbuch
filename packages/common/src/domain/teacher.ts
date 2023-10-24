import type { User } from "@acme/db";

export const formalName = (teacher: User) => {
  if (!teacher.title) {
    return teacher.name;
  }

  return `${teacher.title} ${teacher.name.split(" ").at(-1)}`;
};

export type Teacher = Pick<User, "id" | "name">;
