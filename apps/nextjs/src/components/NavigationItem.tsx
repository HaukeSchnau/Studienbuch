"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import cx from "clsx";

type NavigationItemProps = {
  href: string;
  children: React.ReactNode;
};

const NavigationItem = ({ href, children }: NavigationItemProps) => {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <li
      className={cx(" cursor-pointer rounded-3xl py-4 px-6 transition", {
        "text-white": active,
        "bg-green": active,
        "hover:bg-grey": !active,
      })}
    >
      <Link href={href}>{children}</Link>
    </li>
  );
};

export default NavigationItem;
