"use client";

import type { Route } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

import type { IconName } from "../icon";

export const NavLink = <TUrl extends string>({
  href,
  children,
  icon,
}: {
  href: Route<TUrl>;
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
