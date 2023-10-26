"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import cx from "clsx";

interface NavigationItemProps {
  href?: string;
  action?: () => void;
  children: React.ReactNode;
}

const NavigationItem = ({ href, action, children }: NavigationItemProps) => {
  const pathname = usePathname();
  const active = pathname === href;

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
          {children}
        </Link>
      )}
      {action && (
        <button className="block px-6 py-4" onClick={action}>
          {children}
        </button>
      )}
    </li>
  );
};

export const LogoutButton = () => {
  return (
    <NavigationItem action={() => console.log("TODO")}>Abmelden</NavigationItem>
  );
};

export default NavigationItem;
