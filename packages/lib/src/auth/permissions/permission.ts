import type { z } from "zod";

import type { PermissionSchema } from "@schnau/db/prisma/zod";

import type { PermissionScope } from "./scope";

export type Permission = z.infer<typeof PermissionSchema>;

export interface PermissionOnUser {
  permission: Permission;
  scope: PermissionScope | null;
}
