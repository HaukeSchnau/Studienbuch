import type { Salutation } from "./user";

export interface Teacher {
  salutation: Salutation | null;
  firstName: string;
  lastName: string;
}

export const formalName = (teacher: Teacher) => {
  if (!teacher.salutation) {
    return `${teacher.firstName} ${teacher.lastName}`;
  }

  return `${teacher.salutation} ${teacher.lastName}`;
};

export const formalNameShort = (teacher: Teacher) => {
  if (!teacher.salutation) {
    return `${teacher.firstName} ${teacher.lastName}`;
  }

  if (teacher.salutation === "Herr") {
    return `Hr. ${teacher.lastName}`;
  }

  return `Fr. ${teacher.lastName}`;
};
