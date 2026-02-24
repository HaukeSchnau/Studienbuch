import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, mockUseWebSession, mockFindPermissionScope, mockCheckPassword, mockEq } = vi.hoisted(() => ({
  state: {
    userRows: [] as Array<{
      id: string;
      isSuperUser: boolean;
      email: string | null;
      firstName?: string | null;
      lastName?: string | null;
    }>,
  },
  mockUseWebSession: vi.fn(),
  mockFindPermissionScope: vi.fn(),
  mockCheckPassword: vi.fn(),
  mockEq: vi.fn(() => true),
}));

vi.mock("./session", () => ({
  useWebSession: mockUseWebSession,
}));

vi.mock("@stu/lib-server", () => ({
  checkPassword: mockCheckPassword,
  findPermissionScope: mockFindPermissionScope,
}));

vi.mock("@stu/db", () => ({
  eq: mockEq,
}));

vi.mock("@stu/db/schema", () => ({
  Persons: { id: "persons.id", firstName: "persons.firstName", lastName: "persons.lastName" },
  Users: { id: "users.id", isSuperUser: "users.isSuperUser", email: "users.email" },
}));

vi.mock("@stu/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        leftJoin: () => ({
          where: () => Promise.resolve(state.userRows),
        }),
      }),
    })),
    query: {
      Users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { hasCurrentUserPermission, requireCurrentUserPermission } from "./auth";

describe("hasCurrentUserPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.userRows = [];
  });

  it("returns false without current user", async () => {
    mockUseWebSession.mockResolvedValue({ data: {} });

    await expect(hasCurrentUserPermission("EDIT_USERS")).resolves.toBe(false);
    expect(mockFindPermissionScope).not.toHaveBeenCalled();
  });

  it("returns true when permission scope exists", async () => {
    mockUseWebSession.mockResolvedValue({ data: { userId: "user-1" } });
    state.userRows = [
      {
        id: "user-1",
        isSuperUser: false,
        email: "user@example.com",
        firstName: "User",
        lastName: "One",
      },
    ];
    mockFindPermissionScope.mockResolvedValue({ scope: "school-1" });

    await expect(hasCurrentUserPermission("EDIT_USERS")).resolves.toBe(true);
    expect(mockFindPermissionScope).toHaveBeenCalledWith("user-1", "EDIT_USERS");
  });
});

describe("requireCurrentUserPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.userRows = [
      {
        id: "user-1",
        isSuperUser: false,
        email: "user@example.com",
      },
    ];
    mockUseWebSession.mockResolvedValue({ data: { userId: "user-1" } });
  });

  it("throws FORBIDDEN when permission is missing", async () => {
    mockFindPermissionScope.mockResolvedValue(null);

    await expect(requireCurrentUserPermission("EDIT_USERS")).rejects.toThrow("FORBIDDEN");
  });
});
