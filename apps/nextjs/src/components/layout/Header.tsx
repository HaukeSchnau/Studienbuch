import type { ReactNode } from "react";
import Link from "next/link";

import { isLoggedIn } from "~/features/auth/isLoggedIn";

export const Header = () => {
  return (
    <nav className="mx-auto flex w-min gap-8 rounded-3xl bg-primary-400 px-8 py-4 text-white shadow-md">
      <NavLink href="/roadmap">Roadmap</NavLink>
      <NavLink href="/blog">Blog</NavLink>
      <NavLink href="/about">About</NavLink>
      <NavLink href="/admin">{isLoggedIn() ? "Admin" : "Login"}</NavLink>
    </nav>
  );
};

const NavLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="hover:underline">
    {children}
  </Link>
);
