import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isLoggedIn } from "~/features/auth/isLoggedIn";
import { AdminNav } from "./nav/AdminNav";

interface Props {
  children: ReactNode;
}

export default async function AdminLayout({ children }: Props) {
  if (!(await isLoggedIn())) {
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
          <AdminNav />
        </ul>
      </div>
      <div className="flex-1 overflow-y-auto px-16 py-12">{children}</div>
    </div>
  );
}
