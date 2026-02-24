import { sampleSnapshotResponse, type SnapshotResponse } from "@stu/lib";
import { describe, expect, it, vi } from "vitest";
import { createResolveSnapshotRequest, type SnapshotRequestDependencies } from "./snapshot-request-service";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STUDENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const createDependencies = () => {
  const resolveUserIdFromHeaders = vi.fn<SnapshotRequestDependencies["resolveUserIdFromHeaders"]>(
    async (_headers: Headers) => null,
  );
  const resolveSnapshotForUser = vi.fn<SnapshotRequestDependencies["resolveSnapshotForUser"]>(async (_input) => ({
    students: [],
    courses: [],
    absences: [],
    grades: [],
  }));

  return {
    dependencies: {
      resolveUserIdFromHeaders,
      resolveSnapshotForUser,
    } satisfies SnapshotRequestDependencies,
    resolveUserIdFromHeaders,
    resolveSnapshotForUser,
  };
};

describe("createResolveSnapshotRequest", () => {
  it("returns unauthorized when no user is resolved", async () => {
    const { dependencies, resolveUserIdFromHeaders, resolveSnapshotForUser } = createDependencies();
    const resolve = createResolveSnapshotRequest(dependencies);
    const getBody = vi.fn(async () => ({
      entities: [{ kind: "student", id: STUDENT_ID }],
    }));

    const result = await resolve({
      headers: new Headers(),
      getBody,
    });

    expect(result).toEqual({ status: "unauthorized" });
    expect(resolveUserIdFromHeaders).toHaveBeenCalledWith(expect.any(Headers));
    expect(getBody).not.toHaveBeenCalled();
    expect(resolveSnapshotForUser).not.toHaveBeenCalled();
  });

  it("returns invalid-request when body does not match schema", async () => {
    const { dependencies, resolveUserIdFromHeaders, resolveSnapshotForUser } = createDependencies();
    resolveUserIdFromHeaders.mockResolvedValue(USER_ID);
    const resolve = createResolveSnapshotRequest(dependencies);

    const result = await resolve({
      headers: new Headers(),
      getBody: async () => ({ entities: [] }),
    });

    expect(result).toEqual({ status: "invalid-request" });
    expect(resolveSnapshotForUser).not.toHaveBeenCalled();
  });

  it("returns ok with snapshot for valid request", async () => {
    const { dependencies, resolveUserIdFromHeaders, resolveSnapshotForUser } = createDependencies();
    resolveUserIdFromHeaders.mockResolvedValue(USER_ID);

    const snapshot: SnapshotResponse = sampleSnapshotResponse;
    resolveSnapshotForUser.mockResolvedValue(snapshot);

    const resolve = createResolveSnapshotRequest(dependencies);
    const requestBody = {
      entities: [{ kind: "student", id: STUDENT_ID }],
    } as const;

    const result = await resolve({
      headers: new Headers(),
      getBody: async () => requestBody,
    });

    expect(result).toEqual({
      status: "ok",
      snapshot,
    });
    expect(resolveSnapshotForUser).toHaveBeenCalledWith({
      userId: USER_ID,
      request: requestBody,
    });
  });
});
