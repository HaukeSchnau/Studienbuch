import { redirect, RedirectType } from "next/navigation";

export default function AdminPage() {
  return redirect("/admin/schedules", RedirectType.replace);
}
