import type { Permission } from "@stu/lib";
import { redirect } from "@tanstack/react-router";

import { hasPermissionFn, getSessionFn } from "~/server/functions";

export const requireAuth = async (redirectTo?: string) => {
  const session = await getSessionFn();
  if (!session?.user) {
    throw redirect({
      to: "/login",
      search: redirectTo ? ({ redirect: redirectTo } as never) : undefined,
    });
  }
  return session.user;
};

export const requirePermission = async (permission: Permission, redirectTo = "/") => {
  const allowed = await hasPermissionFn({ data: { permission } });
  if (!allowed) {
    throw redirect({ to: redirectTo as never });
  }
};
