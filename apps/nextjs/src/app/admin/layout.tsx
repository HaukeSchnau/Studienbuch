import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import {
  LogoutButton,
  NavigationItem,
} from "~/components/layout/NavigationItem";
import { isLoggedIn } from "~/features/auth/isLoggedIn";
import { YearSelectField } from "~/features/yearSelect/YearSelectField";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  if (!isLoggedIn()) {
    return redirect("/login");
  }

  return (
    <div className="bg-main-blob flex h-screen overflow-hidden bg-offwhite bg-contain bg-no-repeat">
      <div className="hidden basis-1/6 rounded-r-3xl bg-white p-4 shadow-md md:block">
        <div className="mx-auto w-4/6 py-12">
          <img
            src="/assets/icon.png"
            className="rounded-full"
            alt="IGS Lilienthal Logo"
          />
        </div>
        <YearSelectField />
        <ul className="flex flex-col gap-2">
          <NavigationItem href="/admin/years">Jahrgänge</NavigationItem>
          <NavigationItem href="/admin/schedules">Stundenpläne</NavigationItem>
          <NavigationItem href="/admin/substitutions">
            Vertretungspläne
          </NavigationItem>
          <NavigationItem href="/admin/courses">Kurse</NavigationItem>
          <NavigationItem href="/admin/classes">Klassen</NavigationItem>
          <LogoutButton />
        </ul>
      </div>
      <div className="flex-1 overflow-y-auto px-16 py-12">{children}</div>
    </div>
  );
}
