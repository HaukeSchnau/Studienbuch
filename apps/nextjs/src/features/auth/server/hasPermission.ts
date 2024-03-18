import type { Permission } from "@prisma/client";
import { cache } from "react";

import { findPermissionScope } from "@schnau/lib/src/auth/permissions/hasPermission";

import { api } from "~/infrastructure/trpc/server";

export const hasPermission = cache(
  async (permission: Permission): Promise<boolean> => {
    const session = await api.auth.getSession();
    if (!session?.user) return false;

    const scope = await findPermissionScope(session.user, permission);
    return !!scope;
  },
);
