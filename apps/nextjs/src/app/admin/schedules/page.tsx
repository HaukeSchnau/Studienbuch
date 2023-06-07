import { getServerSession } from "next-auth";

import { authOptions } from "@acme/auth";

export default async function AdminTestPage() {
  return <h1 className="text-5xl font-semibold text-white ">Stundenpläne</h1>;
}
