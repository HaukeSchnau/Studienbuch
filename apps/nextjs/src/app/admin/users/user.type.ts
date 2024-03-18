import type { PermissionOnUser } from "@schnau/lib/src/auth/permissions/permisison";
import type { Role } from "@schnau/lib/src/auth/permissions/role";

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
