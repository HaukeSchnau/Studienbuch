import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { hasPermission } from "~/features/auth/server/hasPermission";

export default async function YearsLayout({ children }: { children: ReactNode }) {
  return (await hasPermission("EDIT_YEARS")) ? children : redirect("/");
}
