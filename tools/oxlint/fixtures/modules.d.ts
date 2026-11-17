// The packages the fixtures import. The workspace root installs none of them, and a fixture only
// needs its import to resolve.
declare module "#/console/ConsoleTesting.ts";

declare module "@effect/atom-react";

declare module "@effect/sql-pg";

declare module "@effect/sql-pglite";

declare module "@effect/sql-sqlite-wasm/SqliteClient";

declare module "@effect/vitest";

declare module "@react-navigation/native";

declare module "@stu/api/System";

declare module "@stu/core";

declare module "@stu/e2ee";

declare module "@stu/e2ee/testing";

declare module "@stu/sync";

declare module "@stu/sync/client";

declare module "@stu/sync/conformance";

declare module "@stu/sync/lab";

declare module "@stu/sync/server";

declare module "@stu/sync/testing";

declare module "@stu/ui/Link";

declare module "@tanstack/react-router";

declare module "drizzle-kit/api-postgres";

declare module "effect";

declare module "effect/Clock";

declare module "effect/Crypto";

declare module "effect/Data";

declare module "effect/DateTime";

declare module "effect/Effect";

declare module "effect/Fiber";

declare module "effect/Layer";

declare module "effect/ManagedRuntime";

declare module "effect/Schema";

declare module "effect/cluster";

declare module "effect/eventlog";

declare module "effect/http-api";

declare module "effect/persistence/KeyValueStore";

declare module "effect/reactivity";

declare module "effect/rpc";

declare module "effect/rpc/RpcServer";

declare module "effect/sql/SqlClient";

declare module "effect/testing/TestClock";

declare module "effect/workers";

declare module "expo";

declare module "expo-notifications";

declare module "expo-router";

declare module "expo-secure-store";

declare module "expo-sqlite";

declare module "jsdom";

declare module "react";

declare module "react-dom";

declare module "react-dom/client";

declare module "react-native";

declare module "react-native-passkeys";

declare module "react/jsx-runtime";

declare module "temporal-polyfill/fns/Now";

declare module "temporal-polyfill/fns/PlainDate";

declare module "temporal-polyfill/global";

declare module "vitest";

declare module "vitest/browser";

// JSX in the .tsx fixtures, without React's types.
declare namespace JSX {
  interface Element {
    readonly props: Attributes;
  }

  type Child = string | number | boolean | Element | undefined;

  interface Attributes {
    readonly [attribute: string]: Child | ReadonlyArray<Child>;
  }

  type IntrinsicElements = Record<string, Attributes>;
}
