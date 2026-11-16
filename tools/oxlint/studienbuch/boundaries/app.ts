import { type Boundary, syncEntry } from "./boundary.ts";

export const app: ReadonlyArray<Boundary> = [
  {
    files: ["apps/web/**"],
    forbidden: ["@stu/sync{,/**}"],
    reason: "apps/web is the landing page and the console. Sync belongs to the Expo app.",
  },
  {
    files: ["apps/app/**", "apps/web/**", "packages/{ui,domain-ui,api}/**"],
    forbidden: [...syncEntry("server"), "@stu/server{,/**}"],
    reason: "Client bundles never include server code.",
  },
  {
    // The files `studienbuch/no-global-process-runtime` calls feature code in vite.config.ts.
    files: ["apps/*/src/{features,domain-ui}/**", "packages/{core,sync,e2ee,api,domain-ui}/**"],
    forbidden: ["expo-secure-store{,/**}", "expo-sqlite{,/**}", "react-native-passkeys{,/**}"],
    reason:
      "The app's infra/ adapters own the device's database, keychain and passkeys. Feature code gets them through a service.",
  },
  {
    files: ["apps/{app,web}/src/infra/**"],
    forbidden: ["apps/{app,web}/src/{!(infra)/**,*}"],
    reason:
      "infra/ exists because of a technology choice, below routes, features and UI. They import it; it imports none of them.",
  },
];
