import type { Salutation } from "./user";

export interface Teacher {
  salutation: Salutation | null;
  name: string;
}

export const formalName = (teacher: Teacher) => {
  if (!teacher.salutation) {
    return teacher.name;
  }

  return `${teacher.salutation} ${teacher.name.split(" ").at(-1)}`;
};
