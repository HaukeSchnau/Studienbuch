"use client";

import { logoutFn } from "~/server/functions";

// oxlint-disable-next-line @typescripteslint/no-empty-function -- Next doesnt like top level await in a server action and the db uses that.
export async function initAction() {}

export async function logout() {
  await logoutFn();
  window.location.href = "/";
}
