import type { Permission } from "@prisma/client";

export interface Role {
  id: number;
  name: string;
  permissions: PermissionOnRole[];
  defaultScope: unknown;
}

interface PermissionOnRole {
  permission: Permission;
  scope: unknown;
}
