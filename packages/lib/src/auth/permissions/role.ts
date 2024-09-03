import type { Permission } from "./permission";

export interface Role {
  id: string;
  name: string;
  permissions: PermissionOnRole[];
  defaultScope: unknown;
}

interface PermissionOnRole {
  permission: Permission;
  scope: unknown;
}
