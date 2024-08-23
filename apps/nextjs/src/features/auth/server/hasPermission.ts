import type { Permission } from "@stu/lib";
import { cache } from "react";
import { findPermissionScope } from "@stu/auth/src/hasPermission";

import { api } from "~/infrastructure/trpc/server";

export const hasPermission = cache(
  async (permission: Permission): Promise<boolean> => {
    const session = await api.auth.getSession();
    if (!session?.user) return false;

    const scope = await findPermissionScope(session.user, permission);
    return !!scope;
  },
);
