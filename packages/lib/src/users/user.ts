export interface User {
  id: number;
  email?: string | null;
  name: string;
  abbrv?: string | null;
  title?: string | null;
  role: Role;
  image?: string | null;
}

export type Role = "TEACHER" | "STUDENT" | "ADMIN";
