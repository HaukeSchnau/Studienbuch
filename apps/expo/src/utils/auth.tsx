import { useEffect, useState } from "react";
import { useRouter } from "expo-router";

import { api } from "./api";
import { useStorage } from "./storage";

export const useRequiredAuthenticatedSession = () => {
  const [session] = useStorage("auth.session");
  const [user] = useStorage("user");

  if (!user || !session) {
    throw new Error("Session is required");
  }

  return { ...session, user };
};

export const useLicenseKey = () => {
  const [licenseKey] = useStorage("auth.licenseKey");
  return licenseKey;
};

export const useSession = () => {
  const [session] = useStorage("auth.session");
  const [user] = useStorage("user");
  return session ? { ...session, user } : null;
};

export const useSessionWatcher = () => {
  const utils = api.useUtils();
  const router = useRouter();
  const login = api.auth.loginWithLicenseKey.useMutation();
  const [licenseKey] = useStorage("auth.licenseKey");
  const [session, setSession] = useStorage("auth.session");

  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (session) {
      setLoading(false);
      return;
    }

    void (async () => {
      if (!licenseKey) {
        setLoading(false);
        return;
      }
      const { error, session } = await login.mutateAsync({
        licenseKey,
      });
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      await setSession(session);
      setLoading(false);

      await utils.invalidate();
      router.replace("/");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseKey]);

  return loading;
};
