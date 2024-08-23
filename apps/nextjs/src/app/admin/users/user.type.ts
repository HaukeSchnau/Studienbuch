import type { PermissionOnUser, Role } from "@stu/lib";

export interface User {
  id: number;
  email?: string | null;
  name: string;
  abbrv?: string | null;
  title?: string | null;
  hasPassword: boolean;
  roles: Omit<Role, "permissions">[];
  isSuperUser: boolean;
  permissions: PermissionOnUser[];
}
