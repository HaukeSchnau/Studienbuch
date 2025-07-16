import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { hasPermission } from "~/features/auth/server/hasPermission";

export default async function CoursesLayout({ children }: { children: ReactNode }) {
  return (await hasPermission("EDIT_COURSES")) ? children : redirect("/");
}
