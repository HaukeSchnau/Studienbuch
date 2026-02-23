import { SnapshotRequestSchema, type SnapshotResponse } from "@stu/lib";
import { getSession, getSessionTokenFromHeaders } from "@stu/lib-server";
import { resolveSnapshotForUser } from "./snapshot-service";

export type SnapshotRequestResult =
  | { status: "unauthorized" }
  | { status: "invalid-request" }
  | { status: "ok"; snapshot: SnapshotResponse };

type ResolveSnapshotRequestInput = {
  headers: Headers;
  getBody: () => Promise<unknown>;
};

const resolveUserIdFromHeaders = async (headers: Headers): Promise<string | null> => {
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

export const resolveSnapshotRequest = async ({
  headers,
  getBody,
}: ResolveSnapshotRequestInput): Promise<SnapshotRequestResult> => {
  const userId = await resolveUserIdFromHeaders(headers);
  if (!userId) {
    return { status: "unauthorized" };
  }

  const body = await getBody().catch(() => null);
  const request = SnapshotRequestSchema.safeParse(body);
  if (!request.success) {
    return { status: "invalid-request" };
  }

  const snapshot = await resolveSnapshotForUser({
    userId,
    request: request.data,
  });

  return {
    status: "ok",
    snapshot,
  };
};
