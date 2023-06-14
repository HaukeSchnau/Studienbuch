import Link from "next/link";
import { useRouter } from "next/router";
import cx from "clsx";
import { signOut } from "next-auth/react";

type NavigationItemProps = {
  href?: string;
  action?: () => void;
  children: React.ReactNode;
};

const NavigationItem = ({ href, action, children }: NavigationItemProps) => {
  const router = useRouter();
  const { pathname } = router;
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
        <Link className="block py-4 px-6" href={href}>
          {children}
        </Link>
      )}
      {action && (
        <button className="block py-4 px-6" onClick={action}>
          {children}
        </button>
      )}
    </li>
  );
};

export const LogoutButton = () => {
  return <NavigationItem action={() => signOut()}>Abmelden</NavigationItem>;
};

export default NavigationItem;
