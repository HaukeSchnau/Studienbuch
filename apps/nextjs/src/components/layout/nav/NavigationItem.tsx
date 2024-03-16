"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import cx from "clsx";

import type { IconName } from "../icon";
import { logout } from "~/features/auth/serverActions/logout";

interface NavigationItemProps {
  href?: string;
  action?: () => void;
  children: ReactNode;
  icon?: IconName;
}

export const NavigationItem = ({
  href,
  action,
  children,
  icon,
}: NavigationItemProps) => {
  const pathname = usePathname();
  const active = pathname === href;

  const content = (
    <div className="flex items-center gap-2">
      {icon && <i className="text-xl">{icon}</i>}
      {children}
    </div>
  );

  return (
    <li
      className={cx("cursor-pointer rounded-3xl transition", {
        "text-white": active,
        "bg-green": active,
        "hover:bg-grey": !active,
      })}
    >
      {href && (
        <Link className="block px-6 py-4" href={href}>
          {content}
        </Link>
      )}
      {action && (
        <button className="block px-6 py-4" onClick={action}>
          {content}
        </button>
      )}
    </li>
  );
};

export const LogoutButton = () => {
  return (
    <NavigationItem action={() => logout()} icon="logout">
      Abmelden
    </NavigationItem>
  );
};
