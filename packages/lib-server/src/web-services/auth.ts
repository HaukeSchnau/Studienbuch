import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Users } from "@stu/db/schema";
import { z } from "zod";

import { getPermissions, getSession, getSessionFromHeaders } from "../auth";

export const sessionTokenSchema = z.string().min(1);
export const sessionUserIdSchema = z.string().uuid();

export interface SessionUser {
  id: string;
  isSuperUser: boolean;
}

const findSessionUser = async (userId: string): Promise<SessionUser | null> => {
  const user = await db.query.Users.findFirst({
    where: eq(Users.id, userId),
    columns: {
      id: true,
      isSuperUser: true,
    },
  });

  if (!user) {
    return null;
  }

  return user;
};

export const getSessionUserByToken = async (sessionToken: string): Promise<SessionUser | null> => {
  const session = await getSession(sessionToken);
  if (!session) {
    return null;
  }

  return findSessionUser(session.user.id);
};

export const getSessionUserFromHeaders = async (headers: Headers): Promise<SessionUser | null> => {
  const session = await getSessionFromHeaders(headers);
  if (!session) {
    return null;
  }

  return findSessionUser(session.user.id);
};

export const getPermissionsByUserId = async (userId: string) => {
  const user = await findSessionUser(userId);
  if (!user) {
    return null;
  }

  return getPermissions(user);
};

export const getSessionPermissionsByToken = async (sessionToken: string) => {
  const user = await getSessionUserByToken(sessionToken);
  if (!user) {
    return null;
  }

  return getPermissions(user);
};

export const getSessionPermissionsFromHeaders = async (headers: Headers) => {
  const user = await getSessionUserFromHeaders(headers);
  if (!user) {
    return null;
  }

  return getPermissions(user);
};
