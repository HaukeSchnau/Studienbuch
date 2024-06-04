import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { colors } from "@schnau/tailwind-config/web";

import { SchoolLogo } from "~/components/SchoolLogo";
import { isLoggedIn } from "~/features/auth/isLoggedIn";
import { initAction } from "~/features/auth/serverActions/logout";
import { AdminNav } from "./nav/AdminNav";

interface Props {
  children: ReactNode;
}

export default async function AdminLayout({ children }: Props) {
  if (!(await isLoggedIn())) {
    return redirect("/login");
  }

  await initAction();

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      <MainBlob className="absolute left-0 top-0 w-full" />
      <div className="relative hidden w-64 overflow-auto rounded-r-3xl bg-white p-4 shadow-md md:block">
        <div className="mx-auto w-4/6 py-12">
          <SchoolLogo />
        </div>
        <ul className="flex flex-col gap-2">
          <AdminNav />
        </ul>
      </div>
      <div className="relative flex-1 overflow-y-auto px-16 py-12">
        {children}
      </div>
    </div>
  );
}

const MainBlob = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 1440 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M-15 281.825V44.5745V-26L1567 -2.97571C1564.92 33.8965 1537.03 133.168 1482.09 153.189C1413.42 178.215 1296.67 174.712 1186.17 175.713C1075.67 176.714 897.662 138.356 790.983 233.774C699.21 315.861 222.654 299.01 -15 281.825Z"
      fill={colors.primary.DEFAULT}
      stroke={colors.accent.DEFAULT}
      strokeWidth="8"
    />
  </svg>
);
