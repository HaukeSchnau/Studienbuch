import { isLoggedInFromHeaders } from "@stu/lib-server";
import { headers } from "next/headers";

export const isLoggedIn = async () => {
  return isLoggedInFromHeaders(await headers());
};
