import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { skipToken, useQuery } from "@tanstack/react-query";
import { eq } from "drizzle-orm";

import { persons } from "@stu/student/schema";

import { db } from "~/db/client";
import { api } from "./api";
import { useStorage } from "./storage";

const useUserQuery = (userId: string | null) =>
  useQuery({
    queryKey: ["user", userId],
    queryFn: userId
      ? async () => {
          const user = await db.query.persons.findFirst({
            where: eq(persons.id, userId),
            with: {
              student: true,
            },
          });
          if (!user) {
            throw new Error("User not found");
          }
          return user;
        }
      : skipToken,
    // TODO: remove need for placeholder data
    placeholderData: {
      id: userId ?? "",
      abbrv: "",
      email: "",
      firstName: "",
      lastName: "",
      salutation: null,
      student: {
        person: "",
        isOfAge: null,
        classIdentifier: "",
        startYear: 0,
        school: "igs-lil",
      },
    },
  });

export const useRequiredAuthenticatedSession = () => {
  const [session] = useStorage("auth.session");
  const user = useUserQuery(session?.user ?? null);

  if (!session) {
    throw new Error("Session is required");
  }

  if (!user.data) {
    throw new Error("No user in query data");
  }

  const formatName = (firstName: string | null, lastName: string | null) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) {
      return firstName;
    }
    if (lastName) {
      return lastName;
    }
    return "";
  };

  return {
    userId: session.user,
    token: session.token,
    user: {
      isOfAge: user.data.student.isOfAge ?? false,
      name: formatName(user.data.firstName, user.data.lastName),
    },
  };
};

export const useLicenseKey = () => {
  const [licenseKey] = useStorage("auth.licenseKey");
  return licenseKey;
};

export const useSession = () => {
  const [session] = useStorage("auth.session");
  return session ? { userId: session.user, token: session.token } : null;
};

/**
 * The session watcher populates the session in the local storage if it doesnt exist yet and returns whether
 * the underlying application is ready to start.
 * It'll also try to re-authenticate with an existing License Key in the background.
 */
export const useSessionWatcher = () => {
  const utils = api.useUtils();
  const router = useRouter();
  const login = api.auth.loginWithLicenseKey.useMutation({
    retry: 3,
    onSuccess: async ({ error, session }) => {
      if (error) {
        console.error(
          "Error while trying to log in with existing license key in background",
          error,
        );
        setSession(null);
        setLoading(false);
      } else {
        await setSession(session);
        setLoading(false);

        await utils.invalidate();
        router.replace("/");
      }
    },
  });
  const [licenseKey] = useStorage("auth.licenseKey");
  const [session, setSession] = useStorage("auth.session");
  const getSessionQuery = api.auth.getSession.useQuery();

  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (session) {
      setLoading(false);
      return;
    }

    if (!licenseKey) {
      setLoading(false);
      return;
    }

    login.mutate({
      licenseKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseKey]);

  useEffect(() => {
    if (getSessionQuery.status !== "success") {
      console.error("Failed to get session.");
      return;
    }

    if (!licenseKey) {
      return;
    }

    if (getSessionQuery.data === null) {
      login.mutate({
        licenseKey,
      });
      return;
    }

    const data = getSessionQuery.data;

    void (async () => {
      await setSession({
        token: data.token,
        user: data.user.id,
      });
      await utils.invalidate();
      router.replace("/");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSessionQuery.status, getSessionQuery.data, licenseKey]);

  return loading;
};
