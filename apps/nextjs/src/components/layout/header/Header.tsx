import { NavLink } from "../nav/NavLink";
import { AdminLink } from "./AdminLink";

export const Header = () => {
  return (
    <nav className="mx-auto flex w-min gap-8 rounded-3xl bg-primary-400 px-8 py-4 text-white shadow-md">
      <NavLink href="/">Home</NavLink>
      <NavLink href="/roadmap">Roadmap</NavLink>
      <AdminLink />
    </nav>
  );
};
