import type { Role } from "../auth/permissions/role";

export interface User {
  id: number;
  email?: string | null;
  name: string;
  abbrv?: string | null;
  title?: string | null;
  role: Role | null;
  image?: string | null;
}
