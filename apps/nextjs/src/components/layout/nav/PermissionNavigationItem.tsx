"use client";

import type { Permission } from "@stu/lib";
import type { Route } from "next";
import type { ReactNode } from "react";

import type { IconName } from "~/components/icon";
import { api } from "~/infrastructure/trpc/react";
import { NavigationItem } from "./NavigationItem";

interface PermissionNavigationItemProps<TUrl extends string> {
  href?: Route<TUrl>;
  children: ReactNode;
  icon?: IconName;
  permission: Permission;
  exact?: boolean;
}

export const PermissionNavigationItem = <TUrl extends string>({
  href,
  children,
  icon,
  permission,
  exact,
}: PermissionNavigationItemProps<TUrl>) => {
  const permissions = api.auth.getPermissions.useQuery();

  if (!permissions.data) return null;
  if (!permissions.data.isSuperUser && !permissions.data[permission]) {
    return null;
  }

  return (
    <NavigationItem href={href} icon={icon} exact={exact}>
      {children}
    </NavigationItem>
  );
};
