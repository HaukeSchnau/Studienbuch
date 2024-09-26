import { useEffect, useState } from "react";
import { useRouter } from "expo-router";

import { api } from "./api";
import { useStorage } from "./storage";

export const useRequiredAuthenticatedSession = () => {
  const [session] = useStorage("auth.session");

  if (!session?.user) {
    throw new Error("Session is required");
  }

  return { ...session, user: session.user };
};

export const useSession = () => {
  const utils = api.useUtils();
  const router = useRouter();
  const login = api.auth.loginWithLicenseKey.useMutation();
  const [licenseKey] = useStorage("auth.licenseKey");
  const [session, setSession] = useStorage("auth.session");

  const [authenticated, setAuthenticated] = useState<boolean | null>(
    session === null ? null : true,
  );

  useEffect(() => {
    if (session) {
      setAuthenticated(true);
      return;
    }

    void (async () => {
      if (!licenseKey) {
        setAuthenticated(false);
        return;
      }
      const { error, session } = await login.mutateAsync({
        licenseKey,
      });
      if (error) {
        console.error(error);
        setAuthenticated(false);
        return;
      }
      await setSession(session);
      setAuthenticated(true);

      await utils.invalidate();
      router.replace("/");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseKey]);

  return authenticated;
};
