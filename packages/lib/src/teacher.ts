export interface User {
  id: number;
  name: string;
  title?: string | null;
  role: Role;
}

export type Role = "TEACHER" | "STUDENT" | "ADMIN";

export type Teacher = Pick<User, "id" | "name" | "title">;

export const formalName = (teacher: Teacher) => {
  if (!teacher.title) {
    return teacher.name;
  }

  return `${teacher.title} ${teacher.name.split(" ").at(-1)}`;
};
