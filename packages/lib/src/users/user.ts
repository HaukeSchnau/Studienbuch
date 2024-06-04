export interface User {
  id: number;
  email?: string | null;
  name: string;
  abbrv?: string | null;
  title?: string | null;
  role: "TEACHER" | "STUDENT" | null;
  image?: string | null;
  isSuperUser: boolean;
}
