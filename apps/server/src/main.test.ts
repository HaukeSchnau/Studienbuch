import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as PgClient from "@effect/sql-pg/PgClient";
import { describe, expect, layer } from "@effect/vitest";
import { Credential } from "@schnau/webuntis-api";
import { Accounts } from "@stu/api/Accounts";
import { Access as AccessApi } from "@stu/api/Access";
import { Enrollment, School, Studienbuch } from "@stu/core";
import { CryptoSuite } from "@stu/e2ee";
import { Command } from "@stu/sync";
import { Listener, Push, SyncServer } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import { desc, eq } from "drizzle-orm";
import * as CliCommand from "effect/cli/Command";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Cron from "effect/Cron";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as SqlClient from "effect/sql/SqlClient";
import { Deletion } from "./account/Deletion.ts";
import { Auth } from "./auth/Auth.ts";
import { NamedSchoolTesting } from "./import/corpus/NamedSchoolTesting.ts";
import { TinySchool } from "./import/evaluation/TinySchool.ts";
import { ImportCommand } from "./import/ImportCommand.ts";
import { ImportJob } from "./import/ImportJob.ts";
import { ImportTesting } from "./import/ImportTesting.ts";
import { AccessCodes } from "./school/AccessCodes.ts";
import { AccessCommand } from "./school/AccessCommand.ts";
import { Sync } from "./sync/Sync.ts";
import { Deployment } from "./infra/config/Deployment.ts";
import { Database } from "./infra/database/Database.ts";
import { DatabaseTesting } from "./infra/database/DatabaseTesting.ts";
import { Mail } from "./infra/mail/Mail.ts";
import { MailTables } from "./infra/mail/MailTables.ts";
import { WebUntisTesting } from "./infra/webuntis/WebUntisTesting.ts";
import { TelemetryTesting } from "./infra/telemetry/TelemetryTesting.ts";

const school = School.Id.make("benannte-schule");

/** The WebUntis account's login, named after a person as school accounts often are. */
const username = "ottokar.pfauenstein";
const webUntisPassword = "Pfauenstein-1961";

/** A student's address and display name, built from the invented teachers' names. */
const email = "quendolin.amselreuter@example.test";
const displayName = "Rodewald Brombeerhag";
const password = "Brombeerhag-geheim-42";

/** A code that names no school, as a student might mistype one. */
const wrongCode = "QXZW-7777-8888-9999";

const env = (database: string) => ({
  STUDIENBUCH_ENVIRONMENT: "development",
  DATABASE_URL: `postgresql://postgres@localhost/${database}?host=${encodeURIComponent(Postgres18.socket ?? "")}`,
  PUBLIC_URL: "http://localhost:3000",
  AUTH_SECRET: "a test secret that is long enough for Better Auth",
  PASSKEY_RP_ID: "localhost",
  MAIL_URL: "capture:",
  MAIL_FROM: "Studienbuch <studienbuch@localhost>",
  WEBUNTIS_SCHOOL_LOGIN_NAME: "erfundene-schule",
  WEBUNTIS_SERVER_URL: "https://webuntis.invalid",
  WEBUNTIS_USERNAME: username,
  WEBUNTIS_PASSWORD: webUntisPassword,
});

/**
 * The server as `serve` runs it, with its request logger, on a prepared database: auth, the sync
 * engine and the import, all under the capturing logger and tracer.
 */
const server = Layer.unwrap(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ readonly name: string }>`select current_database() as name`;

    const engine = SyncServer.layer(Studienbuch.schema).pipe(
      Layer.provide(
        Layer.mergeAll(
          Listener.layer(PgClient.PgClient, (notification) => notification.payload),
          Sync.accountKeys,
          Deletion.accounts,
          CryptoSuite.layer,
        ),
      ),
    );

    return Layer.merge(HttpRouter.serve(Auth.route, { disableListenLog: true }), engine).pipe(
      Layer.provideMerge(NodeHttpServer.layerTest),
      Layer.provideMerge(Auth.layer),
      Layer.provideMerge(Mail.layer),
      Layer.provideMerge(Database.layer),
      Layer.provideMerge(Deployment.layer),
      Layer.provideMerge(
        ConfigProvider.layer(ConfigProvider.fromEnv({ env: env(row?.name ?? "") })),
      ),
    );
  }),
).pipe(
  Layer.provideMerge(DatabaseTesting.prepared),
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(TelemetryTesting.layer),
);

/** One call to Better Auth as a device makes it, from an address of its own. */
const call = Effect.fnUntraced(function* (
  path: string,
  body: Readonly<Record<string, string>>,
  reservation?: string,
) {
  const client = yield* HttpClient.HttpClient;
  const address = `10.${crypto.getRandomValues(new Uint8Array(3)).join(".")}`;

  let request = HttpClientRequest.post(`${Accounts.path}${path}`, {
    headers: { "x-forwarded-for": address, origin: "http://localhost:3000" },
  });

  if (reservation !== undefined) {
    request = HttpClientRequest.setHeader(request, AccessApi.reservationHeader, reservation);
  }

  const response = yield* client.execute(HttpClientRequest.bodyJsonUnsafe(request, body));

  return response.status;
});

/** A browser opening `path`, as someone might who typed their address into the URL. */
const visit = Effect.fnUntraced(function* (path: string) {
  const client = yield* HttpClient.HttpClient;

  // The browser's own spans aren't the server's, so only the server's are captured.
  const response = yield* client
    .execute(HttpClientRequest.get(path, { headers: { "user-agent": `Browser (${email})` } }))
    .pipe(Effect.withTracerEnabled(false));

  return response.status;
});

const codeFor = Effect.fnUntraced(function* (to: string) {
  const db = yield* Database.Drizzle;

  const [mail] = yield* db
    .select()
    .from(MailTables.capturedMail)
    .where(eq(MailTables.capturedMail.to, to))
    .orderBy(desc(MailTables.capturedMail.sentAt));

  return /\b(?<code>\d{6})\b/u.exec(mail?.text ?? "")?.groups?.code ?? "no code";
});

/** The WebUntis names of the first teacher, as an error page or a refusal might quote them. */
const [quoted = ""] = NamedSchoolTesting.names;

/**
 * Three runs over the named school: one that publishes it, one with a refused and a failing read,
 * and one whose login WebUntis refuses.
 */
const imports = Effect.gen(function* () {
  const connection = {
    school: { loginName: "erfundene-schule", serverUrl: "https://webuntis.invalid" },
    credential: Credential.Password({ username, password: Redacted.make(webUntisPassword) }),
  };

  const runOnce = (answer: WebUntisTesting.Options["answer"]) =>
    Effect.flatMap(
      WebUntisTesting.make(NamedSchoolTesting.corpus.reads, {
        asOf: ImportTesting.morning,
        answer,
      }),
      (fake) =>
        ImportJob.runOnce({
          profile: { ...TinySchool.profile, id: school, publish: true },
          run: { cron: Cron.parseUnsafe("30 5 * * *"), nightly: true, maximum: 26 },
          connection,
          transport: fake.layer,
        }),
    ).pipe(ImportTesting.at(ImportTesting.morning));

  const body = (status: number) =>
    Option.some({
      status,
      body: JSON.stringify({ errorMessage: `Kein Zugriff auf ${quoted} für ${username}` }),
      headers: { "content-type": "application/json" },
    });

  const published = yield* runOnce(() => Effect.succeedNone);

  const ran = yield* runOnce((request) =>
    Effect.succeed(
      request.name === "timetable/filter TEACHER"
        ? body(403)
        : request.name === "timetable/entries CLASS 112"
          ? body(500)
          : Option.none(),
    ),
  );

  // WebUntis answers a refused password's token request with its start page.
  const refused = yield* runOnce((request) =>
    Effect.succeed(
      request.name === "api/token/new"
        ? Option.some({ status: 302, body: `<html>${username}</html>` })
        : Option.none(),
    ),
  );

  return [published, ran, refused].map((run) => Option.map(run, ({ outcome }) => outcome));
});

const cli = (args: ReadonlyArray<string>) =>
  CliCommand.runWith(
    CliCommand.make("console").pipe(
      CliCommand.withSubcommands([AccessCommand.command, ImportCommand.command]),
    ),
    { version: "test" },
  )(args);

describe.skipIf(Postgres18.socket === null)("Telemetry", () => {
  layer(server, { excludeTestServices: true })((it) => {
    it.effect("no log line, span or command log row carries a name, an address or a code", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const outcomes = yield* imports;

        const { code } = yield* AccessCodes.mint({ school, kind: "student", maxUses: 5 });
        const reservation = yield* Effect.map(AccessCodes.reserve(code), ({ token }) => token);
        const mistyped = yield* Effect.exit(AccessCodes.reserve(wrongCode));

        const signedUp = yield* call(
          "/sign-up/email",
          { email, password, name: displayName },
          reservation,
        );

        const confirmed = yield* call(
          "/email-otp/verify-email",
          { email, otp: yield* codeFor(email), password },
          reservation,
        );

        const signedIn = yield* call("/sign-in/email", { email, password });
        const wrongPassword = yield* call("/sign-in/email", { email, password: `${password}x` });
        const unknown = yield* call("/sign-in/email", { email: `x${email}`, password });

        const typed = [
          yield* visit(`${Accounts.path}/${email}`),
          yield* visit(`/nirgends/${email}?code=${code}`),
        ];

        yield* cli(["access", "admit", "--email", email, "--school", school]);
        yield* Effect.exit(cli(["access", "admit", "--email", `x${email}`, "--school", school]));
        yield* cli(["access", "code", "list", "--school", school]);
        yield* cli(["import", "status"]);

        const [account] = yield* sql<{ readonly id: string; readonly notebook: string }>`
          select u.id, s.id as notebook from auth_user u
          join space_member m on m.account_id = u.id
          join space s on s.id = m.space_id and s.kind = 'notebook'
          where u.email = ${email}
        `;

        const [term] = yield* sql<{ readonly id: string }>`
          select id from sync_row where space_id = ${school} and tbl = 'Term' order by id limit 1
        `;

        const [course] = yield* sql<{ readonly id: string }>`
          select id from sync_row where space_id = ${school} and tbl = 'Course' order by id limit 1
        `;

        const pushed = yield* Push.Service.use((push) =>
          push.push(account?.id ?? "", {
            clientId: "phone",
            syncEpoch: null,
            contract: Studienbuch.schema.contract,
            commands: [
              Command.Mutate.make({
                mutationId: 1,
                name: Enrollment.set.name,
                version: Enrollment.set.version,
                args: {
                  notebook: account?.notebook ?? "",
                  termId: term?.id ?? "",
                  gradeLevel: 11,
                  courseIds: [course?.id ?? ""],
                },
                at: DateTime.makeUnsafe(0),
              }),
            ],
          }),
        );

        const commandLog = yield* sql<{ readonly line: string }>`
          select row_to_json(c)::text as line from command_log c
        `;

        const { lines, served } = yield* TelemetryTesting.Captured;

        yield* served;
        const all = [...lines, ...commandLog.map(({ line }) => `command_log ${line}`)];

        const seeded = [
          ...NamedSchoolTesting.names,
          username,
          webUntisPassword,
          email,
          displayName,
          password,
          code,
          code.replaceAll("-", ""),
          wrongCode,
        ];

        expect({
          outcomes,
          mistyped: mistyped._tag,
          auth: [signedUp, confirmed, signedIn, wrongPassword, unknown],
          typed,
          pushed: pushed.outcomes.map((outcome) =>
            outcome._tag === "Rejected" ? outcome.reason._tag : outcome._tag,
          ),
          leaks: TelemetryTesting.holding(all, seeded),
        }).toEqual({
          outcomes: [
            Option.some("Published"),
            Option.some("Incomplete"),
            Option.some("CredentialsRefused"),
          ],
          mistyped: "Failure",
          auth: [200, 200, 200, 401, 401],
          typed: [404, 404],
          pushed: ["Enrollment.ClassRequired"],
          leaks: [],
        });

        // Every path wrote something, so the search above searched it.
        expect(
          [
            "span ImportJob.runOnce",
            "span TimetableClient.getFilter",
            "span AccessCodes.reserve",
            `attribute http.route="/api/auth/*"`,
            "span AccessCommand.admit",
            "span Push.process",
          ].filter((part) => !lines.some((line) => line.includes(part))),
        ).toEqual([]);
      }),
    );
  });
});
