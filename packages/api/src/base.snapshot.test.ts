import { beforeEach, describe, expect, it, vi } from "vitest";
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
        tasks?: unknown[];
      };
    };

const { resolveSnapshotRequest } = vi.hoisted(() => ({
  resolveSnapshotRequest: vi.fn(
    async (_input: SnapshotRouteInput): Promise<SnapshotRouteResult> => ({
      status: "unauthorized",
    }),
  ),
}));

vi.mock("pino", () => ({
  default: vi.fn(() => ({
    info: vi.fn(() => undefined),
    error: vi.fn(() => undefined),
  })),
}));

vi.mock("@groundswell/adapter-hono-server", () => ({
  attachSyncServer: vi.fn(() => undefined),
}));

vi.mock("@hono/trpc-server", () => ({
  trpcServer: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("@stu/api", () => ({
  appRouter: {},
  createTRPCContext: vi.fn(async () => ({})),
}));

vi.mock("@stu/db", () => ({
  sql: vi.fn(() => undefined),
}));

vi.mock("@stu/db/client", () => ({
  db: {
    execute: vi.fn(async () => undefined),
  },
}));

vi.mock("@stu/lib-server", () => ({
  getSession: vi.fn(async () => null),
  getSessionTokenFromHeaders: vi.fn(() => null),
}));

vi.mock("../env", () => ({
  env: {
    AXIOM_DATASET: "test-dataset",
    AXIOM_TOKEN: "test-token",
    PULSAR_URL: "tcp://localhost:6650",
  },
}));

vi.mock("./services/snapshot-request-service", () => ({
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
    const body = await response.json();
    expect(body).toEqual(snapshot);
    expect(Object.prototype.hasOwnProperty.call(body, "tasks")).toBe(false);
  });

  it("preserves tasks in HTTP 200 snapshot passthrough when present", async () => {
    const snapshot = {
      students: [],
      courses: [],
      absences: [],
      grades: [],
      tasks: [{ id: "task-1", title: "Task 1" }],
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
    const body = await response.json();
    expect(body).toEqual(snapshot);
    expect(body.tasks).toEqual(snapshot.tasks);
  });
});
