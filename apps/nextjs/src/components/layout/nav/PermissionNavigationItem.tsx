import type { Permission } from "@prisma/client";
import type { ReactNode } from "react";

import type { IconName } from "../icon";
import { hasPermission } from "~/features/auth/server/hasPermission";
import { NavigationItem } from "./NavigationItem";

interface PermissionNavigationItemProps {
  href?: string;
  children: ReactNode;
  icon?: IconName;
  permission: Permission;
}

export const PermissionNavigationItem = async ({
  href,
  children,
  icon,
  permission,
}: PermissionNavigationItemProps) => {
  if (!(await hasPermission(permission))) {
    return null;
  }

  return (
    <NavigationItem href={href} icon={icon}>
      {children}
    </NavigationItem>
  );
};
