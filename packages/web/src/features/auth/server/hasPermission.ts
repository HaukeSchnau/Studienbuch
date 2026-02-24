import type { Permission } from "@stu/lib";
import { hasPermissionFn } from "~/server/functions";

export const hasPermission = async (permission: Permission): Promise<boolean> => {
  return hasPermissionFn({ data: { permission } });
};
