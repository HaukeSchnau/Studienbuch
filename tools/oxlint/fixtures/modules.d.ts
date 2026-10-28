// The packages the fixtures import. The workspace root installs none of them, and a fixture only
// needs its import to resolve.
declare module "@stu/core";

declare module "@stu/sync";

declare module "@stu/sync/client";

declare module "@stu/sync/server";

declare module "effect";

declare module "effect/Clock";

declare module "effect/Data";

declare module "effect/Effect";

declare module "effect/rpc";

declare module "effect/rpc/RpcServer";

declare module "effect/sql/SqlClient";

declare module "expo-notifications";

declare module "expo-secure-store";

declare module "expo-sqlite";

declare module "react";

declare module "react-native";

declare module "temporal-polyfill/fns/PlainDate";

declare module "temporal-polyfill/global";

declare module "vitest";
