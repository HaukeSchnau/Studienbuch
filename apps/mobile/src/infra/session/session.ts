import { useSessionData } from "~/infra/data/hooks";

/**
 * Placeholder session for the mock data provider.
 *
 * TODO: Replace both hooks with the Better Auth Expo client in `infra/data/auth-client.ts` once
 * the mobile app has a real session. Until then every screen sees the same synthetic student, and
 * the ids below are not real principals.
 */
const mockSession = { userId: "student-1", token: "mock-session" } as const;

export const useRequiredAuthenticatedSession = () => {
  const { user } = useSessionData();

  return {
    ...mockSession,
    user: { name: user.name, isOfAge: user.isOfAge },
  };
};

export const useSession = () => mockSession;
