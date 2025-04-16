import type { Permission } from "@stu/lib";
import { findPermissionScope } from "@stu/lib-server";

import { api } from "~/infrastructure/trpc/server";

export const hasPermission = async (
  permission: Permission,
): Promise<boolean> => {
  "use cache";

  const session = await api.auth.getSession();
  if (!session?.user) return false;

  const scope = await findPermissionScope(session.user.id, permission);
  return !!scope;
};
