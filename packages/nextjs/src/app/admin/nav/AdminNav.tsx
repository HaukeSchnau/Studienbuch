import {
  LogoutButton,
  NavigationItem,
} from "~/components/layout/nav/NavigationItem";
import { PermissionNavigationItem } from "~/components/layout/nav/PermissionNavigationItem";
import { SchoolsNav } from "./SchoolsNav";

export const AdminNav = () => {
  return (
    <>
      <SchoolsNav />
      <hr className="opacity-20" />
      <PermissionNavigationItem
        permission="EDIT_USERS"
        href="/admin/users"
        icon="person"
      >
        Nutzer
      </PermissionNavigationItem>
      <PermissionNavigationItem
        permission="EDIT_USERS"
        href="/admin/people"
        icon="person"
      >
        Personen
      </PermissionNavigationItem>
      <NavigationItem href="/impressum">Impressum</NavigationItem>
      <NavigationItem href="/datenschutz">Datenschutz</NavigationItem>
      <hr className="opacity-20" />
      <LogoutButton />
    </>
  );
};
