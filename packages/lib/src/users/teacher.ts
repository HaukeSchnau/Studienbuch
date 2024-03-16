import type { User } from "./user";

export type Teacher = Pick<User, "id" | "name" | "title">;

export const formalName = (teacher: Teacher) => {
  if (!teacher.title) {
    return teacher.name;
  }

  return `${teacher.title} ${teacher.name.split(" ").at(-1)}`;
};
