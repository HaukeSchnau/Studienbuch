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

export const formalNameShort = (teacher: Teacher) => {
  if (!teacher.salutation) {
    return teacher.name;
  }

  if (teacher.salutation === "Herr") {
    return `Hr. ${teacher.name.split(" ").at(-1)}`;
  }

  return `Fr. ${teacher.name.split(" ").at(-1)}`;
};
