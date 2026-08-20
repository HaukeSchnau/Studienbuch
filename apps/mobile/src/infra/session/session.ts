import { useSessionData } from "~/infra/data/hooks";

export const useRequiredAuthenticatedSession = () => {
  const { user } = useSessionData();

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
