import { SnapshotRequestSchema, type SnapshotResponse } from "@stu/lib";
import { resolveUserIdFromHeaders } from "./session-service";
import { resolveSnapshotForUser } from "./snapshot-service";

export type SnapshotRequestResult =
  | { status: "unauthorized" }
  | { status: "invalid-request" }
  | { status: "ok"; snapshot: SnapshotResponse };

type ResolveSnapshotRequestInput = {
  headers: Headers;
  getBody: () => Promise<unknown>;
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
