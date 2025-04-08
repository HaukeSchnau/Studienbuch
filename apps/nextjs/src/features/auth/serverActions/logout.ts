"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { api } from "~/infrastructure/trpc/server";

// eslint-disable-next-line @typescript-eslint/no-empty-function -- Next doesnt like top level await in a server action and the db uses that.
export async function initAction() {}

export async function logout() {
  await api.auth.logout();
  (await cookies()).delete("session");
  redirect("/");
}
