import { NavLink } from "../nav/NavLink";
import { AdminLink } from "./AdminLink";

export const Header = () => {
  return (
    <nav className="mx-auto flex w-min gap-8 rounded-3xl bg-primary-pale px-8 py-4 text-white shadow-md">
      <NavLink href="/" icon="home">
        Home
      </NavLink>
      <NavLink href="/roadmap" icon="map">
        Roadmap
      </NavLink>
      <AdminLink />
    </nav>
  );
};
