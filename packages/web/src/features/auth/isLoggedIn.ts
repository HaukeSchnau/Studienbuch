import { getSessionFn } from "~/server/functions";

export const isLoggedIn = async () => {
  const session = await getSessionFn();
  return !!session?.user;
};
