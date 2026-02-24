import { useSession } from "@tanstack/react-start/server";

export interface WebSessionData {
  userId?: string;
}

const defaultSessionSecret = "studienbuch-web-dev-session-secret-change-me-1234567890";

export const useWebSession = () =>
  useSession<WebSessionData>({
    name: "studienbuch-web-session",
    password: process.env.SESSION_SECRET ?? defaultSessionSecret,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    },
  });
