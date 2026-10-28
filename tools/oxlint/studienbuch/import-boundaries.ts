import * as NodePath from "node:path";

import { defineRule, type ESTree } from "@oxlint/plugins";

import { layoutPath } from "./repository-path.ts";
import { isStringLiteral, moduleExportName } from "./syntax.ts";

interface Boundary {
  /** Globs over repository paths of the files the boundary applies to. */
  readonly files: ReadonlyArray<string>;
  /** Globs over import specifiers, and over repository paths for relative imports. */
  readonly forbidden: ReadonlyArray<string>;
  /** When set, only these imported names are forbidden, along with namespace and default imports. */
  readonly names?: ReadonlyArray<string>;
  readonly reason: string;
}

const react = ["react{,/**}", "react-dom{,/**}"];
const reactNative = ["react-native{,-*}{,/**}", "@react-native{,-*}/**"];
const expo = ["expo{,-*}{,/**}", "@expo/**"];
const node = ["node:*{,/**}"];

const sqlClients = [
  "effect/sql{,/**}",
  "@effect/sql-*{,/**}",
  "drizzle-orm{,/**}",
  "expo-sqlite{,/**}",
  "@electric-sql/**",
  "pg{,/**}",
  "kysely{,/**}",
];

const syncClient = ["@stu/sync/client{,/**}", "packages/sync/**/{client,Client}{/**,.ts}"];
const syncServer = ["@stu/sync/server{,/**}", "packages/sync/**/{server,Server}{/**,.ts}"];

// AGENTS.md, "Where code lives". Every boundary that matches a file applies.
const BOUNDARIES: ReadonlyArray<Boundary> = [
  {
    files: ["packages/core/**"],
    forbidden: [
      ...react,
      ...reactNative,
      ...expo,
      ...node,
      ...syncClient,
      ...syncServer,
      ...sqlClients,
    ],
    reason:
      "packages/core is the domain. It runs on every platform and inside mutators, so it imports no UI, platform API, sync client or server, or SQL client.",
  },
  {
    files: ["packages/core/**"],
    forbidden: ["effect/Clock", "effect/Random"],
    reason: "Mutators read no clock or randomness. Ids and timestamps arrive as arguments.",
  },
  {
    files: ["packages/core/**"],
    forbidden: ["effect"],
    names: ["Clock", "Random"],
    reason: "Mutators read no clock or randomness. Ids and timestamps arrive as arguments.",
  },
  {
    files: ["packages/sync/**/{client,Client}{/**,.ts}"],
    forbidden: syncServer,
    reason: "The sync client runs on devices and never bundles the server.",
  },
  {
    files: ["packages/sync/**/{server,Server}{/**,.ts}"],
    forbidden: syncClient,
    reason: "The sync server runs in Node and never loads the device client.",
  },
  {
    files: ["packages/e2ee/**"],
    forbidden: [
      ...sqlClients,
      "expo-secure-store{,/**}",
      "expo-file-system{,/**}",
      "@react-native-async-storage/**",
      "node:{fs,net,http,https,http2,tls,dgram,sqlite}{,/**}",
      "effect/{http,socket,rpc}{,/**}",
      "effect/{FileSystem,KeyValueStore}",
      "@effect/platform-*{,/**}",
    ],
    reason:
      "packages/e2ee seals and opens envelopes over a CryptoSuite. It stores nothing and opens no connection.",
  },
  {
    files: ["apps/web/**"],
    forbidden: ["@stu/sync{,/**}"],
    reason: "apps/web is the landing page and the console. Sync belongs to the Expo app.",
  },
  {
    files: ["apps/app/**", "apps/web/**", "packages/{ui,domain-ui,api}/**"],
    forbidden: [...syncServer, "@stu/server{,/**}"],
    reason: "Client bundles never include server code.",
  },
  {
    files: ["packages/ui/**"],
    forbidden: ["@stu/{core,sync,e2ee,api,domain-ui}{,/**}"],
    reason: "packages/ui is the design system and knows no domain type.",
  },
  {
    files: ["packages/domain-ui/**"],
    forbidden: ["@stu/sync{,/**}", ...sqlClients],
    reason:
      "packages/domain-ui components take rows and callbacks. They read no SQLite and no sync engine.",
  },
  {
    files: ["packages/api/**"],
    forbidden: ["effect/rpc/RpcServer", "@effect/platform-*{,/**}"],
    reason: "packages/api declares RPC groups and schemas. Handlers live in apps/server.",
  },
  {
    files: ["packages/api/**"],
    forbidden: ["effect/rpc"],
    names: ["RpcServer"],
    reason: "packages/api declares RPC groups and schemas. Handlers live in apps/server.",
  },
  {
    files: ["apps/server/**"],
    forbidden: [...expo, ...reactNative],
    reason: "apps/server runs in Node. Expo and React Native packages never load there.",
  },
  {
    files: ["**"],
    forbidden: ["temporal-polyfill", "temporal-polyfill/global{,/**}", "@js-temporal/**"],
    reason:
      "Civil time uses the functional API of temporal-polyfill/fns; the global shim mutates the runtime (ADR 0001).",
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    forbidden: ["vitest"],
    reason: "Tests import from @effect/vitest, which re-exports Vitest with Effect support.",
  },
];

// A namespace or default import reaches every name of a module, the forbidden ones included.
const WHOLE_MODULE = new Set(["*", "default"]);

function isRelative(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../");
}

/** Code imports only what its place in the repository allows. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Enforce the import boundaries between packages and app directories.",
    },
    messages: {
      forbidden: "`{{source}}` is out of bounds here. {{reason}}",
      forbiddenName: "`{{name}}` from `{{source}}` is out of bounds here. {{reason}}",
    },
  },
  create(context) {
    const file = layoutPath(context);

    const boundaries = BOUNDARIES.filter((boundary) =>
      boundary.files.some((glob) => NodePath.matchesGlob(file, glob)),
    );

    if (boundaries.length === 0) return {};

    const directory = NodePath.posix.dirname(file);

    /** The specifier, plus the repository path of a relative import. */
    const targets = (source: string) =>
      isRelative(source) ? [source, NodePath.posix.join(directory, source)] : [source];

    const crossing = (source: string) => {
      const candidates = targets(source);

      return boundaries.filter((boundary) =>
        boundary.forbidden.some((glob) =>
          candidates.some((candidate) => NodePath.matchesGlob(candidate, glob)),
        ),
      );
    };

    /** Reports what `source` gives this file: named bindings, `default`, or `*` for all of it. */
    const check = (
      source: string,
      node: ESTree.Node,
      names: ReadonlyArray<{ readonly name: string; readonly node: ESTree.Node }>,
    ) => {
      for (const boundary of crossing(source)) {
        if (boundary.names === undefined) {
          context.report({
            node,
            messageId: "forbidden",
            data: { source, reason: boundary.reason },
          });
          continue;
        }

        for (const imported of names) {
          if (WHOLE_MODULE.has(imported.name) || boundary.names.includes(imported.name)) {
            context.report({
              node: imported.node,
              messageId: "forbiddenName",
              data: { name: imported.name, source, reason: boundary.reason },
            });
          }
        }
      }
    };

    return {
      ImportDeclaration(node) {
        check(
          node.source.value,
          node.source,
          node.specifiers.map((specifier) => ({
            name:
              specifier.type === "ImportSpecifier"
                ? moduleExportName(specifier.imported)
                : specifier.type === "ImportDefaultSpecifier"
                  ? "default"
                  : "*",
            node: specifier,
          })),
        );
      },
      ExportNamedDeclaration(node) {
        if (node.source === null) return;

        check(
          node.source.value,
          node.source,
          node.specifiers.map((specifier) => ({
            name: moduleExportName(specifier.local),
            node: specifier,
          })),
        );
      },
      ExportAllDeclaration(node) {
        check(node.source.value, node.source, [{ name: "*", node }]);
      },
      ImportExpression(node) {
        if (isStringLiteral(node.source)) {
          check(node.source.value, node.source, [{ name: "*", node }]);
        }
      },
    };
  },
});
