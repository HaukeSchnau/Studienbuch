import { type Boundary, expo, reactNative, syncEntry } from "./boundary.ts";

export const server: ReadonlyArray<Boundary> = [
  {
    files: ["apps/server/**"],
    forbidden: [...expo, ...reactNative],
    reason: "apps/server runs in Node. Expo and React Native packages never load there.",
  },
  {
    files: ["apps/server/**"],
    forbidden: ["client", "lab", "conformance"].flatMap(syncEntry),
    reason:
      "apps/server runs the sync server. The device client, the Sync Lab and the conformance suite never load there.",
  },
  {
    files: ["apps/server/src/infra/**"],
    forbidden: ["apps/server/src/{!(infra)/**,*}"],
    reason:
      "infra/ exists because of a technology choice, below the server's domain directories. They import it; it imports none of them.",
  },
];
