import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import {
  LogoutButton,
  NavigationItem,
} from "~/components/layout/nav/NavigationItem";
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
          <NavigationItem href="/admin/years">Jahrgänge</NavigationItem>
          <hr className="opacity-20" />
          <YearSelectField />
          <YearNav />
          <NavigationItem href="/admin/substitutions">
            Vertretungspläne
          </NavigationItem>
          <hr className="opacity-20" />
          <NavigationItem href="/admin/users" icon="person">
            Personen
          </NavigationItem>
          <NavigationItem href="/admin/groups" icon="groups">
            Gruppen
          </NavigationItem>
          <NavigationItem href="/admin/permissions" icon="security">
            Rechte
          </NavigationItem>
          <NavigationItem href="/admin/logs" icon="contract">
            Logs
          </NavigationItem>
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
