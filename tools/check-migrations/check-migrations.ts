// Fails when this tree adds a server migration that sorts before the newest on main. It reads main
// from Gitea, not from this branch's base, because a sibling may have merged since.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpIncomingMessage from "effect/http/HttpIncomingMessage";
import * as Schema from "effect/Schema";
import drizzle from "../../apps/server/drizzle.config.ts";

import { MigrationOrder } from "./MigrationOrder.ts";

const root = NodePath.resolve(import.meta.dirname, "../..");
const folder = NodePath.join("apps/server", drizzle.out ?? "migrations");

// The public repository. Calder's pull-request jobs reach it through the egress allowlist (infra
// `modules/features/calder/nixos.nix`).
const listing = `https://git.schnau.dev/api/v1/repos/schnau/Studienbuch/contents/${folder}?ref=main`;

const decodeEntries = HttpIncomingMessage.schemaBodyJson(
  Schema.Array(Schema.Struct({ name: Schema.String, type: Schema.String })),
);

/** The migration folders on main. */
const readMain = HttpClient.get(listing).pipe(
  Effect.flatMap(HttpClientResponse.filterStatusOk),
  Effect.flatMap(decodeEntries),
  Effect.map((entries) => entries.flatMap(({ name, type }) => (type === "dir" ? [name] : []))),
  Effect.timeout("30 seconds"),
  Effect.provide(FetchHttpClient.layer),
);

const local = NodeFS.readdirSync(NodePath.join(root, folder)).filter((name) =>
  NodeFS.existsSync(NodePath.join(root, folder, name, "migration.sql")),
);

const main = await Effect.runPromiseExit(readMain);

if (Exit.isFailure(main)) {
  console.error(`check:migrations: couldn't read main's migrations from ${listing}`);
  console.error(Cause.pretty(main.cause));
  process.exit(1);
}

const { newest, late } = MigrationOrder.late(local, main.value);

if (late.length === 0) {
  console.log(`${folder}: nothing this tree adds sorts before main's newest, ${newest ?? "none"}.`);
} else {
  const one = late.length === 1;
  const count = one ? "1 migration that sorts" : `${late.length} migrations that sort`;
  const them = one ? "it" : "them";

  console.error(
    [
      `${folder} has ${count} before main's newest, ${newest}:`,
      ...late.map(({ name }) => `  ${name}`),
      `Migrations apply in name order. A database that applied main's newest would apply ${them} out`,
      `of order, and any release without ${them} would then fail prepare there, so beta couldn't roll`,
      "back. Rename each folder so it sorts after main's newest:",
      // Later ones first, since a rename may take the name of a folder that moves after it.
      ...late
        .toReversed()
        .map(({ name, rename }) =>
          rename === null
            ? `  ${name}: give it a timestamp after ${newest}`
            : `  mv ${folder}/${name} ${folder}/${rename}`,
        ),
      "This pull request's preview then starts over with an empty database.",
    ].join("\n"),
  );
  process.exitCode = 1;
}
