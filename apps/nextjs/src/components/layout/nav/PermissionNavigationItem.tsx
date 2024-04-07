"use client";

import type { Permission } from "@prisma/client";
import type { Route } from "next";
import type { ReactNode } from "react";

import type { IconName } from "../icon";
import { api } from "~/infrastructure/trpc/react";
import { NavigationItem } from "./NavigationItem";

interface PermissionNavigationItemProps<TUrl extends string> {
  href?: Route<TUrl>;
  children: ReactNode;
  icon?: IconName;
  permission: Permission;
}

export const PermissionNavigationItem = <TUrl extends string>({
  href,
  children,
  icon,
  permission,
}: PermissionNavigationItemProps<TUrl>) => {
  const permissions = api.auth.getPermissions.useQuery();

  if (!permissions.data) return null;
  if (permissions.data !== "ALL" && !permissions.data[permission]) {
    return null;
  }

  return (
    <NavigationItem href={href} icon={icon}>
      {children}
    </NavigationItem>
  );
};
