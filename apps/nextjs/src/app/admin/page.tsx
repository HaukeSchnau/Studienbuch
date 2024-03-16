import { redirect, RedirectType } from "next/navigation";

export default function AdminPage() {
  return redirect("/admin/years", RedirectType.replace);
}
