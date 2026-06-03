import { useMockApp } from "~/mock-app/provider";

export const useRequiredAuthenticatedSession = () => {
  const { user } = useMockApp();

  return {
    userId: "student-1",
    token: "mock-session",
    user: {
      name: user.name,
      isOfAge: user.isOfAge,
    },
  };
};

export const useSession = () => ({
  userId: "student-1",
  token: "mock-session",
});
