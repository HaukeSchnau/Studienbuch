import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSessionFn, mockHasPermissionFn, mockRedirect } = vi.hoisted(() => ({
  mockGetSessionFn: vi.fn(),
  mockHasPermissionFn: vi.fn(),
  mockRedirect: vi.fn((options: Record<string, unknown> | undefined) => ({
    __type: "redirect",
    ...options,
  })),
}));

vi.mock("~/server/functions", () => ({
  getSessionFn: mockGetSessionFn,
  hasPermissionFn: mockHasPermissionFn,
}));

vi.mock("@tanstack/react-router", () => ({
  redirect: mockRedirect,
}));

import { requireAuth, requirePermission } from "./guards";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user when session exists", async () => {
    const user = { id: "user-1" };
    mockGetSessionFn.mockResolvedValue({ user });

    await expect(requireAuth()).resolves.toEqual(user);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to login with redirect search when unauthenticated", async () => {
    mockGetSessionFn.mockResolvedValue(null);

    await expect(requireAuth("/admin")).rejects.toMatchObject({
      to: "/login",
      search: { redirect: "/admin" },
    });
    expect(mockRedirect).toHaveBeenCalledWith({
      to: "/login",
      search: { redirect: "/admin" },
    });
  });
});

describe("requirePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows access when permission check passes", async () => {
    mockHasPermissionFn.mockResolvedValue(true);

    await expect(requirePermission("EDIT_USERS")).resolves.toBeUndefined();
    expect(mockHasPermissionFn).toHaveBeenCalledWith({ data: { permission: "EDIT_USERS" } });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to the given target when permission check fails", async () => {
    mockHasPermissionFn.mockResolvedValue(false);

    await expect(requirePermission("EDIT_USERS", "/forbidden")).rejects.toMatchObject({
      to: "/forbidden",
    });
    expect(mockRedirect).toHaveBeenCalledWith({ to: "/forbidden" });
  });
});
