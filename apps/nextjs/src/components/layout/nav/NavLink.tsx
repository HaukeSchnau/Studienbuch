"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

import type { IconName } from "../icon";

export const NavLink = ({
  href,
  children,
  icon,
}: {
  href: string;
  children: ReactNode;
  icon?: IconName;
}) => {
  const currentPath = usePathname();
  const isActive = currentPath === href;

  return (
    <Link href={href} className="flex gap-2">
      {icon && <i className="text-base">{icon}</i>}
      <span className={clsx("hover:underline", isActive && "underline")}>
        {children}
      </span>
    </Link>
  );
};
