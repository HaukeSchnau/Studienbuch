import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import {
  LogoutButton,
  NavigationItem,
} from "~/components/layout/nav/NavigationItem";
import { PermissionNavigationItem } from "~/components/layout/nav/PermissionNavigationItem";
import { isLoggedIn } from "~/features/auth/isLoggedIn";
import { YearSelectField } from "~/features/yearSelect/YearSelectField";
import { YearNav } from "./YearNav";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  if (!isLoggedIn()) {
    return redirect("/login");
  }

  return (
    <div className="bg-main-blob flex h-screen overflow-hidden bg-offwhite bg-contain bg-no-repeat">
      <div className="hidden basis-1/6 overflow-auto rounded-r-3xl bg-white p-4 shadow-md md:block">
        <div className="mx-auto w-4/6 py-12">
          <img
            src="/assets/icon.png"
            className="rounded-full"
            alt="IGS Lilienthal Logo"
          />
        </div>
        <ul className="flex flex-col gap-2">
          <PermissionNavigationItem permission="EDIT_YEARS" href="/admin/years">
            Jahrgänge
          </PermissionNavigationItem>
          <hr className="opacity-20" />
          <YearSelectField />
          <YearNav>
            <PermissionNavigationItem
              permission="EDIT_CLASSES"
              href="/admin/classes"
            >
              Klassen
            </PermissionNavigationItem>
            <PermissionNavigationItem
              permission="EDIT_COURSES"
              href="/admin/courses"
            >
              Kurse
            </PermissionNavigationItem>
            <PermissionNavigationItem
              permission="EDIT_COURSES"
              href="/admin/schedules"
            >
              Stundenpläne
            </PermissionNavigationItem>
          </YearNav>
          <NavigationItem href="/admin/substitutions">
            Vertretungspläne
          </NavigationItem>
          <hr className="opacity-20" />
          <PermissionNavigationItem
            permission="EDIT_USERS"
            href="/admin/users"
            icon="person"
          >
            Personen
          </PermissionNavigationItem>
          <PermissionNavigationItem
            permission="EDIT_USERS"
            href="/admin/groups"
            icon="groups"
          >
            Gruppen
          </PermissionNavigationItem>
          <PermissionNavigationItem
            permission="EDIT_USERS"
            href="/admin/permissions"
            icon="security"
          >
            Rechte
          </PermissionNavigationItem>
          <PermissionNavigationItem
            permission="VIEW_LOGS"
            href="/admin/logs"
            icon="contract"
          >
            Logs
          </PermissionNavigationItem>
          <NavigationItem href="/admin/settings" icon="settings">
            Einstellungen
          </NavigationItem>
          <NavigationItem href="/impressum">Impressum</NavigationItem>
          <NavigationItem href="/datenschutz">Datenschutz</NavigationItem>
          <hr className="opacity-20" />
          <LogoutButton />
        </ul>
      </div>
      <div className="flex-1 overflow-y-auto px-16 py-12">{children}</div>
    </div>
  );
}
