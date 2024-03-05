import { isLoggedIn } from "~/features/auth/isLoggedIn";
import { NavLink } from "./NavLink";

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
