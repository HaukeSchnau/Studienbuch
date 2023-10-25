import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import NavigationItem, { LogoutButton } from "~/components/NavigationItem";
import { isLoggedIn } from "~/features/auth/isLoggedIn";
import { YearSelectField } from "~/features/yearSelect/YearSelectField";
import { getCurrentUrl } from "~/utils/getCurrentUrl";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  const { pathname } = getCurrentUrl();

  if (pathname !== "/login" && !isLoggedIn()) {
    return redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-offwhite bg-main-blob bg-contain bg-no-repeat">
      <div className="w-80 rounded-r-3xl bg-white p-4 shadow-md">
        <img
          src="/assets/icon.png"
          className="rounded-full p-12"
          alt="IGS Lilienthal Logo"
        />
        <YearSelectField />
        <ul className="flex flex-col gap-2">
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
