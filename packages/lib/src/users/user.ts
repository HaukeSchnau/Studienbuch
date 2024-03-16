export interface User {
  id: number;
  email?: string | null;
  name: string;
  abbrv?: string | null;
  title?: string | null;
  role: Role;
  image?: string | null;
}

export const roles = ["TEACHER", "STUDENT", "ADMIN"] as const;
export type Role = (typeof roles)[number];

export const roleMap: Record<Role, string> = {
  TEACHER: "Lehrer",
  STUDENT: "Schüler",
  ADMIN: "Administrator",
};
