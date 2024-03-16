import type { Role } from "@schnau/lib/src/users/user";

export interface User {
  id: number;
  email?: string | null;
  name: string;
  abbrv?: string | null;
  title?: string | null;
  role: Role;
  hasPassword: boolean;
}
