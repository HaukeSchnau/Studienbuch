import { useQuery } from "@tanstack/react-query";
import { Redirect, useSegments } from "expo-router";
import { currentStudent } from "~/db/queries/user";
import { useSession } from "./auth";
import { isE2eModeEnabled } from "./e2e";

export const MissingInfoGuard = ({ children }: { children: React.ReactNode }) => {
  const pathname = useSegments();
  const session = useSession();
  const currentStudentQuery = useQuery(currentStudent());
  const isE2eRoute = pathname[0] === "e2e";

  if (isE2eRoute && isE2eModeEnabled()) {
    return children;
  }

  if (!session) {
    if (pathname[0] === "setup" && pathname[1] === "license-key") return children;

    return <Redirect href="/setup/license-key" />;
  }

  if (currentStudentQuery.isPending) {
    return null;
  }

  if (!currentStudentQuery.data) {
    if (pathname[0] === "setup" && pathname[1] === "name-and-year") return children;

    return <Redirect href="/setup/name-and-year" />;
  }

  return children;
};
