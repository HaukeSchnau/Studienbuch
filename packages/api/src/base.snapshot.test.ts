import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Effect } from "effect";

type SnapshotRouteInput = {
  headers: Headers;
  getBody: () => Promise<unknown>;
};

type SnapshotRouteResult =
  | { status: "unauthorized" }
  | { status: "invalid-request" }
  | {
      status: "ok";
      snapshot: {
        students: unknown[];
        courses: unknown[];
        absences: unknown[];
        grades: unknown[];
      };
    };

const resolveSnapshotRequest = mock(
  async (_input: SnapshotRouteInput): Promise<SnapshotRouteResult> => ({ status: "unauthorized" }),
);

mock.module("pino", () => ({
  default: mock(() => ({
    info: mock(() => undefined),
    error: mock(() => undefined),
  })),
}));

mock.module("@groundswell/adapter-hono-server", () => ({
  attachSyncServer: mock(() => undefined),
}));

mock.module("@hono/trpc-server", () => ({
  trpcServer: mock(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

mock.module("@stu/api", () => ({
  appRouter: {},
  createTRPCContext: mock(async () => ({})),
}));

mock.module("@stu/db", () => ({
  sql: mock(() => undefined),
}));

mock.module("@stu/db/client", () => ({
  db: {
    execute: mock(async () => undefined),
  },
}));

mock.module("@stu/lib-server", () => ({
  getSession: mock(async () => null),
  getSessionTokenFromHeaders: mock(() => null),
}));

mock.module("../env", () => ({
  env: {
    AXIOM_DATASET: "test-dataset",
    AXIOM_TOKEN: "test-token",
    PULSAR_URL: "tcp://localhost:6650",
  },
}));

mock.module("./services/snapshot-request-service", () => ({
  resolveSnapshotRequest,
}));

const { DomainBroadcast, DomainIngestEngine } = await import("./boilerplate");
const { createBase } = await import("./base");

const SNAPSHOT_PATH = "/v1/api/snapshot";

const buildApp = () =>
  Effect.runPromise(
    createBase("/v1").pipe(
      Effect.provideService(DomainIngestEngine, {} as never),
      Effect.provideService(DomainBroadcast, {} as never),
    ),
  );

describe("/api/snapshot route wiring", () => {
  beforeEach(() => {
    resolveSnapshotRequest.mockReset();
  });

  it("maps unauthorized result to HTTP 401", async () => {
    resolveSnapshotRequest.mockResolvedValue({
      status: "unauthorized",
    });

    const app = await buildApp();
    const requestBody = {
      entities: [{ kind: "student", id: "11111111-1111-4111-8111-111111111111" }],
    };
    const response = await app.request(SNAPSHOT_PATH, {
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });

    expect(resolveSnapshotRequest).toHaveBeenCalledTimes(1);
    const [input] = resolveSnapshotRequest.mock.calls[0]!;
    expect(input.headers).toBeInstanceOf(Headers);
    expect(input.headers.get("authorization")).toBe("Bearer token");
    expect(input.getBody).toEqual(expect.any(Function));
    await expect(input.getBody()).resolves.toEqual(requestBody);
  });

  it("maps invalid-request result to HTTP 400", async () => {
    resolveSnapshotRequest.mockResolvedValue({
      status: "invalid-request",
    });

    const app = await buildApp();
    const response = await app.request(SNAPSHOT_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid snapshot request" });
  });

  it("maps ok result to HTTP 200 with snapshot body passthrough", async () => {
    const snapshot = {
      students: [],
      courses: [],
      absences: [],
      grades: [],
    };
    resolveSnapshotRequest.mockResolvedValue({
      status: "ok",
      snapshot,
    });

    const app = await buildApp();
    const response = await app.request(SNAPSHOT_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
  });
});
