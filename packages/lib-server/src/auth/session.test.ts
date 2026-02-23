import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const findFirst = vi.fn();
  const deleteWhere = vi.fn();
  const deleteSession = vi.fn(() => ({
    where: deleteWhere,
  }));

  return {
    findFirst,
    deleteSession,
    deleteWhere,
  };
});

vi.mock("@stu/db/client", () => ({
  db: {
    query: {
      Sessions: {
        findFirst: mocks.findFirst,
      },
    },
    delete: mocks.deleteSession,
  },
}));

import { getSessionFromHeaders, isLoggedInFromHeaders } from "./index";
import { getSession } from "./session";

describe("auth/session", () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.deleteSession.mockClear();
    mocks.deleteWhere.mockClear();
  });

  it("returns null when session token does not exist", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const session = await getSession("missing-session");

    expect(session).toBeNull();
    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });

  it("removes expired sessions and returns null", async () => {
    mocks.findFirst.mockResolvedValue({
      token: "expired-token",
      expires: new Date("2020-01-01T00:00:00.000Z"),
      user: {
        id: "user-1",
      },
    });

    const session = await getSession("expired-token");

    expect(session).toBeNull();
    expect(mocks.deleteSession).toHaveBeenCalledTimes(1);
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
  });

  it("returns normalized session for valid sessions", async () => {
    mocks.findFirst.mockResolvedValue({
      token: "valid-token",
      expires: new Date("2099-01-01T00:00:00.000Z"),
      user: {
        id: "user-42",
      },
    });

    const session = await getSession("valid-token");

    expect(session).toEqual({
      token: "valid-token",
      user: {
        id: "user-42",
      },
    });
    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });

  it("reads session token from headers/cookies and reports login status", async () => {
    mocks.findFirst.mockResolvedValue({
      token: "cookie-token",
      expires: new Date("2099-01-01T00:00:00.000Z"),
      user: {
        id: "user-cookie",
      },
    });

    const loggedIn = await isLoggedInFromHeaders(new Headers({ cookie: "session=cookie-token" }));
    const session = await getSessionFromHeaders(new Headers({ cookie: "session=cookie-token" }));

    expect(loggedIn).toBe(true);
    expect(session).toEqual({
      token: "cookie-token",
      user: {
        id: "user-cookie",
      },
    });
  });

  it("returns null/false when headers have no session token", async () => {
    const session = await getSessionFromHeaders(new Headers());
    const loggedIn = await isLoggedInFromHeaders(new Headers());

    expect(session).toBeNull();
    expect(loggedIn).toBe(false);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
