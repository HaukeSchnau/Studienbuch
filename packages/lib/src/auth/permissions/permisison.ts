import type { Permission } from "@prisma/client";

import type { PermissionScope } from "./scope";

export interface PermissionOnUser {
  permission: Permission;
  scope: PermissionScope | null;
}
