import { Redirect, useSegments } from "expo-router";
import { useSession } from "./auth";
import { useQuery } from "@tanstack/react-query";
import { currentStudent } from "~/db/queries/user";

export const MissingInfoGuard = ({
  children,
}: { children: React.ReactNode }) => {
  const pathname = useSegments();
  const session = useSession();
  const currentStudentQuery = useQuery(currentStudent());

  if (!session) {
    if (pathname[0] === "setup" && pathname[1] === "license-key")
      return children;

    return <Redirect href="/setup/license-key" />;
  }

  if (currentStudentQuery.isPending) {
    return <></>;
  }

  if (!currentStudentQuery.data) {
    if (pathname[0] === "setup" && pathname[1] === "name-and-year")
      return children;

    return <Redirect href="/setup/name-and-year" />;
  }

  return children;
};
