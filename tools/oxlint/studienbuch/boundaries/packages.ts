import {
  type Boundary,
  expo,
  node,
  react,
  reactNative,
  sqlClients,
  syncEntry,
  syncFiles,
} from "./boundary.ts";

const ambient = "Mutators read no clock or randomness. Ids and timestamps arrive as arguments.";

const handlers = "packages/api declares RPC groups and schemas. Handlers live in apps/server.";

// AGENTS.md, "Where code lives", and the atlas's monorepo map.
export const packages: ReadonlyArray<Boundary> = [
  {
    files: ["packages/core/**"],
    forbidden: [
      ...react,
      ...reactNative,
      ...expo,
      ...node,
      ...sqlClients,
      "@stu/{e2ee,api}{,/**}",
      ...["client", "server", "lab", "conformance"].flatMap(syncEntry),
    ],
    reason:
      "packages/core is the domain. It runs on every platform and inside mutators, so it imports no UI, platform API, SQL client, e2ee or api, and of sync only the definition API.",
  },
  {
    files: ["packages/core/**"],
    forbidden: ["effect/{Clock,Random,Crypto}", "temporal-polyfill/fns/Now"],
    reason: ambient,
  },
  {
    files: ["packages/core/**"],
    forbidden: ["effect"],
    names: ["Clock", "Random", "Crypto"],
    reason: ambient,
  },
  {
    files: [syncFiles("client")],
    forbidden: syncEntry("server"),
    reason: "The sync client runs on devices and never bundles the server.",
  },
  {
    files: [syncFiles("server")],
    forbidden: syncEntry("client"),
    reason: "The sync server runs in Node and never loads the device client.",
  },
  {
    // The package root: the definition API, `Tx`, the wire protocol and whatever joins them later.
    files: [
      "packages/sync/src/!(client|server|lab|conformance|simulation|testing)/**",
      "packages/sync/src/index.ts",
    ],
    forbidden: [
      ...["client", "server", "lab", "conformance", "testing"].flatMap(syncEntry),
      syncFiles("simulation"),
    ],
    reason:
      "The root of packages/sync is what core and both engine sides build on, so it imports neither side, the Lab or the test machinery.",
  },
  {
    files: [syncFiles("lab")],
    forbidden: syncEntry("server"),
    reason: "The Sync Lab runs in the app's web build and never bundles the server.",
  },
  {
    files: ["packages/e2ee/**"],
    forbidden: [
      ...sqlClients,
      "expo-secure-store{,/**}",
      "expo-file-system{,/**}",
      "@react-native-async-storage/**",
      "node:{fs,net,http,https,http2,tls,dgram,sqlite}{,/**}",
      "effect/{http,http-api,socket,rpc,persistence,reactivity,workers,cluster,eventlog}{,/**}",
      "effect/FileSystem",
      "@effect/platform-*{,/**}",
    ],
    reason:
      "packages/e2ee seals and opens envelopes over a CryptoSuite. It stores nothing and opens no connection.",
  },
  {
    files: ["packages/ui/**"],
    forbidden: ["@stu/{core,sync,e2ee,api,domain-ui}{,/**}"],
    reason: "packages/ui is the design system and knows no domain type.",
  },
  {
    files: ["packages/domain-ui/**"],
    forbidden: ["@stu/{sync,e2ee,api}{,/**}", "effect/rpc{,/**}", ...sqlClients],
    reason:
      "packages/domain-ui components take rows and callbacks. They read no SQLite or sync engine, open nothing sealed and call no server.",
  },
  {
    files: ["packages/api/**"],
    forbidden: ["effect/rpc/RpcServer", "@effect/platform-*{,/**}"],
    reason: handlers,
  },
  {
    files: ["packages/api/**"],
    forbidden: ["effect/rpc"],
    names: ["RpcServer"],
    reason: handlers,
  },
  {
    files: ["packages/api/**"],
    forbidden: [...sqlClients, "@stu/sync{,/**}", ...node],
    reason:
      "Every client bundles packages/api, so its schemas reach no database, sync engine or Node API.",
  },
];
