import type { AppRouter } from "@stu/api";

import type { ClientRouter } from "../utils/local-trpc/trpc-util";
import { getStorage, setStorage } from "~/utils/storage";

export const clientRouter: ClientRouter<AppRouter> = {
  auth: {
    getSession: {
      persist: async (_, session) => setStorage("auth.session", session),
      read: () => getStorage("auth.session"),
    },
  },
};
