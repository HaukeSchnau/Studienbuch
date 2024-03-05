"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export const NavLink = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => {
  const currentPath = usePathname();
  const isActive = currentPath === href;

  return (
    <Link
      href={href}
      className={clsx("hover:underline", isActive && "underline")}
    >
      {children}
    </Link>
  );
};
