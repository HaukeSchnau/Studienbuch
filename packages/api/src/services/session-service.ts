import { getSession, getSessionTokenFromHeaders } from "@stu/lib-server";

export const resolveUserIdFromHeaders = async (headers: Headers): Promise<string | null> => {
  const sessionToken = getSessionTokenFromHeaders(headers);
  if (!sessionToken) {
    return null;
  }

  const session = await getSession(sessionToken);
  if (!session) {
    return null;
  }

  return session.user.id;
};
