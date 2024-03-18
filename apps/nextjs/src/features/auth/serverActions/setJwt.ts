"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const setJwt = async (jwt: string) => {
  cookies().set("jwt", jwt);
  redirect("/admin");
};

export const setSessionToken = async (sessionToken: string) => {
  cookies().set("session", sessionToken);
  redirect("/admin");
};
