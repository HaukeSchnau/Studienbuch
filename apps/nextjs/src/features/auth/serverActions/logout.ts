"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { api } from "~/infrastructure/trpc/server";

export async function logout() {
  await api.auth.logout();
  cookies().delete("session");
  redirect("/");
}
