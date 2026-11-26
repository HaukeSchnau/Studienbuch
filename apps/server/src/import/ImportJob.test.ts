import { describe, expect, it, layer } from "@effect/vitest";
import { Credential } from "@schnau/webuntis-api";
import type { System } from "@stu/api/System";
import { School } from "@stu/core";
import { Postgres18 } from "@stu/sync/testing";
import * as Command from "effect/cli/Command";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Cron from "effect/Cron";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import { Deployment } from "../infra/config/Deployment.ts";
import { RecordedWebUntis } from "../infra/webuntis/RecordedWebUntis.ts";
import { WebUntisTesting } from "../infra/webuntis/WebUntisTesting.ts";
import { SchoolTesting } from "../school/SchoolTesting.ts";
import type { Corpus } from "./corpus/Corpus.ts";
import { NamedSchoolTesting } from "./corpus/NamedSchoolTesting.ts";
import { TinySchool } from "./evaluation/TinySchool.ts";
import { ImportCommand } from "./ImportCommand.ts";
import { ImportJob } from "./ImportJob.ts";
import { ImportTesting } from "./ImportTesting.ts";

const { morning } = ImportTesting;
const minutesAfter = (minutes: number) => DateTime.add(morning, { minutes });

const connection = {
  school: { loginName: "erfundene-schule", serverUrl: "https://webuntis.invalid" },
  credential: Credential.Password({ username: "konto-a", password: Redacted.make("erfunden") }),
};

const nightly = { cron: Cron.parseUnsafe("30 5 * * *"), nightly: true, maximum: 26 };

const profileOf = (school: string) => ({
  ...TinySchool.profile,
  id: School.Id.make(school),
  publish: true,
});

const entries = (resource: number) => `GET timetable/entries CLASS ${resource}`;

/** What a run over the fake WebUntis did, and what the fake saw. */
const runWith = (
  school: string,
  options: {
    readonly answer?: WebUntisTesting.Options["answer"];
    readonly tokenMinutes?: number;
    readonly maximum?: number;
    readonly corpus?: Corpus.Corpus;
    readonly at?: DateTime.Utc;
  } = {},
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const fake = yield* WebUntisTesting.make((options.corpus ?? TinySchool.corpus).reads, {
      asOf: morning,
      answer: options.answer,
      tokenMinutes: options.tokenMinutes,
    });

    const ran = yield* ImportJob.runOnce({
      profile: profileOf(school),
      run: { ...nightly, maximum: options.maximum ?? nightly.maximum },
      connection,
      transport: fake.layer,
    }).pipe(ImportTesting.at(options.at ?? morning));

    const events = yield* fake.events;

    const [rows] = yield* sql<{ readonly count: number }>`
      select count(*)::int as count from sync_row r join space s on s.id = r.space_id
      where s.id = ${school} or s.parent_id = ${school}
    `;

    const [state] = yield* sql<{ readonly pausedBy: string | null }>`
      select paused_by as "pausedBy" from import_school where school_id = ${school}
    `;

    return {
      outcome: Option.map(ran, ({ outcome }) => outcome),
      report: Option.map(ran, ({ report }) => report),
      sent: events.filter((event) => event.startsWith("→")).map((event) => event.slice(2)),
      events,
      rows: rows?.count ?? 0,
      pausedBy: state?.pausedBy ?? null,
    };
  });

/** Answers the first request of `name` with `status`, and leaves the rest to the recording. */
const firstAnswered = (name: string, status: number) =>
  Effect.map(
    Ref.make(false),
    (answered) => (request: WebUntisTesting.Request) =>
      `${request.method} ${request.name}` === name
        ? Ref.getAndSet(answered, true).pipe(
            Effect.map((before) => (before ? Option.none() : Option.some({ status }))),
          )
        : Effect.succeedNone,
  );

const login = ["GET index.do", "POST j_spring_security_check", "GET api/token/new", "GET app/data"];

/** After logging in: school years, app data, time grid, four directories and exams. */
const reads = [
  "GET schoolyears",
  "GET app/data",
  "GET timegrid",
  "GET timetable/filter CLASS",
  "GET timetable/filter TEACHER",
  "GET timetable/filter SUBJECT",
  "GET timetable/filter ROOM",
  "GET exams",
];

/** The recording, with its school year ending in the window and the next one starting after it. */
const crossing: Corpus.Corpus = (() => {
  const path = RecordedWebUntis.paths.schoolYears;
  const [first] = TinySchool.corpus.reads.get(path)?.versions ?? [];

  const years = [
    { id: 10, name: "2026/2027", dateRange: { start: "2026-08-13", end: "2026-11-15" } },
    { id: 11, name: "2026/2027 B", dateRange: { start: "2026-11-16", end: "2027-07-07" } },
  ];

  return {
    ...TinySchool.corpus,
    reads: new Map([
      ...TinySchool.corpus.reads,
      [path, { versions: first === undefined ? [] : [{ ...first, body: years }] }],
    ]),
  };
})();

/** The recording, with WebUntis calling an earlier school year current than the one of today. */
const earlierCurrent = NamedSchoolTesting.planted(
  TinySchool.corpus,
  RecordedWebUntis.paths.appData,
  (body) => {
    NamedSchoolTesting.object(body.currentSchoolYear).id = 9;
  },
);

describe.skipIf(Postgres18.socket === null)("ImportJob on PostgreSQL 18", () => {
  // The live clock, moved to the invented school's dates for each run (`ImportTesting.at`).
  layer(SchoolTesting.database, { excludeTestServices: true })((it) => {
    it.effect("a run logs in once and reads its plan: fifteen requests, then a publish", () =>
      Effect.gen(function* () {
        const ran = yield* runWith("job-full");

        expect({
          outcome: ran.outcome,
          sent: ran.sent,
          unplanned: Option.map(ran.report, ({ unplanned }) => unplanned),
          published: ran.rows > 0,
        }).toEqual({
          outcome: Option.some("Published"),
          sent: [...login, ...reads, entries(111), entries(112), entries(113)],
          unplanned: Option.some([]),
          published: true,
        });
      }),
    );

    it.effect("a run whose window crosses into the next school year sends no more", () =>
      Effect.gen(function* () {
        const ran = yield* runWith("job-crossing", { corpus: crossing });

        expect({ outcome: ran.outcome, sent: ran.sent.length }).toEqual({
          outcome: Option.some("Published"),
          sent: login.length + reads.length + 3,
        });
      }),
    );

    it.effect("reads the school year of today, whichever WebUntis calls current", () =>
      Effect.gen(function* () {
        const named = yield* Ref.make<ReadonlyArray<string>>([]);

        const answer = (request: WebUntisTesting.Request) =>
          Ref.update(named, (all) => [
            ...all,
            `${request.name}: ${request.schoolYear ?? "none"}`,
          ]).pipe(Effect.as(Option.none()));

        const ran = yield* runWith("job-current", { corpus: earlierCurrent, answer });
        const years = (yield* Ref.get(named)).filter((line) => /^(timetable|exams)/u.test(line));

        expect([ran.outcome, years]).toEqual([
          Option.some("Published"),
          [
            "timetable/filter CLASS: 10",
            "timetable/filter TEACHER: 10",
            "timetable/filter SUBJECT: 10",
            "timetable/filter ROOM: 10",
            "exams: 10",
            "timetable/entries CLASS 111: 10",
            "timetable/entries CLASS 112: 10",
            "timetable/entries CLASS 113: 10",
          ],
        ]);
      }),
    );

    it.effect("a 401 whose body never ends still ends the run as a lost session", () =>
      Effect.gen(function* () {
        const clock = yield* TestClock.make();
        const { promise: reading, resolve } = Promise.withResolvers<void>();

        // Its body starts being read only after the connection has seen the 401.
        const body = new ReadableStream<Uint8Array>(
          {
            pull: () => {
              resolve();

              // A pull that never settles, so the body neither ends nor is pulled again.
              return Promise.withResolvers<void>().promise;
            },
          },
          { highWaterMark: 0 },
        );

        const unauthorized = yield* firstAnswered("GET app/data", 401);

        const answer = (request: WebUntisTesting.Request) =>
          Effect.map(
            unauthorized(request),
            Option.map((given) => ({ ...given, body })),
          );

        const run = yield* Effect.forkChild(
          runWith("job-stalled", { answer }).pipe(Effect.provideService(Clock.Clock, clock)),
        );

        yield* Effect.promise(() => reading);
        yield* clock.adjust("5 minutes");
        const ran = yield* Fiber.join(run);

        expect([ran.outcome, ran.sent]).toEqual([Option.some("SessionLost"), login]);
      }),
    );

    it.effect(
      "a run doesn't wait for a lease its row keeps locked; the lease passes by itself",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const school = "job-locked";
          const requested = yield* Deferred.make<void>();
          const locked = yield* Deferred.make<void>();
          const unlock = yield* Deferred.make<void>();

          // The run's first request waits until another transaction holds the school's row, and the
          // run then loses its session, so it writes no checkpoint to that row before its release.
          const unauthorized = yield* firstAnswered("GET app/data", 401);

          const answer = (request: WebUntisTesting.Request) =>
            request.name === "index.do"
              ? Deferred.succeed(requested, undefined).pipe(
                  Effect.andThen(Deferred.await(locked)),
                  Effect.as(Option.none()),
                )
              : unauthorized(request);

          const run = yield* Effect.forkChild(runWith(school, { answer }));
          yield* Deferred.await(requested);

          const holder = yield* Effect.forkChild(
            sql.withTransaction(
              sql`select 1 from import_school where school_id = ${school} for update`.pipe(
                Effect.andThen(Deferred.succeed(locked, undefined)),
                Effect.andThen(Deferred.await(unlock)),
              ),
            ),
          );

          // Without the bounded release this join would wait for the unlock below.
          const ran = yield* Fiber.join(run);
          yield* Deferred.succeed(unlock, undefined);
          yield* Fiber.join(holder);

          const [lease] = yield* sql<{ readonly held: boolean }>`
          select lease_owner is not null as held from import_school where school_id = ${school}
        `;

          expect([ran.outcome, lease?.held]).toEqual([Option.some("SessionLost"), true]);
        }),
    );

    it.effect("a run keeps its outcome when the connection clearing its lease dies", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const school = "job-killed";
        const requested = yield* Deferred.make<void>();
        const locked = yield* Deferred.make<void>();
        const unlock = yield* Deferred.make<void>();
        const unauthorized = yield* firstAnswered("GET app/data", 401);

        const answer = (request: WebUntisTesting.Request) =>
          request.name === "index.do"
            ? Deferred.succeed(requested, undefined).pipe(
                Effect.andThen(Deferred.await(locked)),
                Effect.as(Option.none()),
              )
            : unauthorized(request);

        const run = yield* Effect.forkChild(runWith(school, { answer }));
        yield* Deferred.await(requested);

        const holder = yield* Effect.forkChild(
          sql.withTransaction(
            sql`select 1 from import_school where school_id = ${school} for update`.pipe(
              Effect.andThen(Deferred.succeed(locked, undefined)),
              Effect.andThen(Deferred.await(unlock)),
            ),
          ),
        );

        // The release waits for the row, and its connection ends while it waits.
        const ended = yield* sql<{ readonly ended: boolean }>`
          select pg_terminate_backend(pid) as ended from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock'
            and query like '%update import_school set lease_until = null%'
        `.pipe(Effect.repeat({ until: (rows) => rows.some(({ ended }) => ended) }));

        const ran = yield* Fiber.join(run);
        yield* Deferred.succeed(unlock, undefined);
        yield* Fiber.join(holder);

        expect([ran.outcome, ended.length]).toEqual([Option.some("SessionLost"), 1]);
      }),
    );

    it.effect("a 401 on the metadata bootstrap ends the run, and nothing is sent after it", () =>
      Effect.gen(function* () {
        const ran = yield* runWith("job-bootstrap", {
          answer: yield* firstAnswered("GET app/data", 401),
        });

        expect({ outcome: ran.outcome, events: ran.events, rows: ran.rows }).toEqual({
          outcome: Option.some("SessionLost"),
          events: [
            "→ GET index.do",
            "← 200 GET index.do",
            "→ POST j_spring_security_check",
            "← 302 POST j_spring_security_check",
            "→ GET api/token/new",
            "← 200 GET api/token/new",
            "→ GET app/data",
            "← 401 GET app/data",
          ],
          rows: 0,
        });
      }),
    );

    it.effect("a 401 on a batch's first view ends the run; only views in flight complete", () =>
      Effect.gen(function* () {
        const thirdStarted = yield* Deferred.make<void>();
        const firstDone = yield* Deferred.make<void>();

        // The first view answers 401 once the third is in flight, which answers after it.
        const answer = (request: WebUntisTesting.Request) => {
          const name = `${request.method} ${request.name}`;

          if (name === entries(111)) {
            return Deferred.await(thirdStarted).pipe(
              Effect.andThen(Deferred.succeed(firstDone, undefined)),
              Effect.as(Option.some({ status: 401 })),
            );
          }

          if (name === entries(113)) {
            return Deferred.succeed(thirdStarted, undefined).pipe(
              Effect.andThen(Deferred.await(firstDone)),
              Effect.as(Option.none()),
            );
          }

          return Effect.succeedNone;
        };

        const ran = yield* runWith("job-batch", { answer });
        const unauthorized = ran.events.indexOf(`← 401 ${entries(111)}`);

        expect({
          outcome: ran.outcome,
          sent: ran.sent,
          sentAfter: ran.events.slice(unauthorized).filter((event) => event.startsWith("→")),
          rows: ran.rows,
        }).toEqual({
          outcome: Option.some("SessionLost"),
          sent: [...login, ...reads, entries(111), entries(112), entries(113)],
          sentAfter: [],
          rows: 0,
        });
      }),
    );

    it.effect("a second login fails the run, and its form is never sent", () =>
      Effect.gen(function* () {
        // A token WebUntis says expires within the minute makes webuntis-api log in again.
        const ran = yield* runWith("job-relogin", { tokenMinutes: 0.5 });

        expect({ outcome: ran.outcome, sent: ran.sent, rows: ran.rows }).toEqual({
          outcome: Option.some("SessionLost"),
          // The bootstrap's login check finds the token stale before its first read.
          sent: [...login.slice(0, 3), "GET index.do"],
          rows: 0,
        });
      }),
    );

    it.effect("a refused password pauses the job at once, and the next run sends nothing", () =>
      Effect.gen(function* () {
        // WebUntis answers a refused password's token request with its start page.
        const refusing = yield* firstAnswered("GET api/token/new", 302);
        const refused = yield* runWith("job-refused", { answer: refusing });
        const next = yield* runWith("job-refused", { at: minutesAfter(10) });

        expect({
          refused: [refused.outcome, refused.sent, refused.pausedBy],
          next: [next.outcome, next.sent],
        }).toEqual({
          refused: [Option.some("CredentialsRefused"), login.slice(0, 3), ImportJob.pausedBy],
          next: [Option.some("Paused"), []],
        });
      }),
    );

    it.effect("two lost sessions in a row pause the job, and one between full runs doesn't", () =>
      Effect.gen(function* () {
        const lost = (minutes: number) =>
          Effect.flatMap(firstAnswered("GET app/data", 401), (answer) =>
            runWith("job-streak", { answer, at: minutesAfter(minutes) }),
          );

        const runs = [
          yield* lost(0),
          yield* runWith("job-streak", { at: minutesAfter(10) }),
          yield* lost(20),
          yield* lost(30),
        ];

        expect(runs.map(({ outcome, pausedBy }) => [outcome, pausedBy])).toEqual([
          [Option.some("SessionLost"), null],
          [Option.some("Published"), null],
          [Option.some("SessionLost"), null],
          [Option.some("SessionLost"), ImportJob.pausedBy],
        ]);
      }),
    );

    it.effect(
      "a run sends no more than its reservation, and no view its reservation can't hold",
      () =>
        Effect.gen(function* () {
          // Eleven requests reach the directories: the exams read is refused unsent.
          const short = yield* runWith("job-short", { maximum: 11 });
          // Fourteen leave two for three class views, so the plan reads none of them.
          const small = yield* runWith("job-small", { maximum: 14 });

          const failures = (ran: typeof short) =>
            Option.map(ran.report, (report) => Object.keys(report.failures).sort());

          expect({
            short: [short.outcome, short.sent, failures(short)],
            small: [small.outcome, small.sent, failures(small)],
          }).toEqual({
            short: [
              Option.some("Incomplete"),
              [...login, ...reads.slice(0, 7)],
              Option.some(["ImportRun.PlanTooLarge", "TransportError"]),
            ],
            small: [
              Option.some("Incomplete"),
              [...login, ...reads],
              Option.some(["ImportRun.PlanTooLarge"]),
            ],
          });
        }),
    );

    it.effect("the console's commands never reach WebUntis, even with credentials at hand", () =>
      Effect.gen(function* () {
        const fake = yield* WebUntisTesting.make(TinySchool.corpus.reads, { asOf: morning });
        const cli = Command.runWith(ImportCommand.command, { version: "test" });

        const env = {
          STUDIENBUCH_ENVIRONMENT: "beta",
          WEBUNTIS_SCHOOL_LOGIN_NAME: "erfundene-schule",
          WEBUNTIS_SERVER_URL: "https://webuntis.invalid",
          WEBUNTIS_USERNAME: "konto-a",
          WEBUNTIS_PASSWORD: "erfunden",
        };

        const lines = yield* Effect.gen(function* () {
          yield* cli(["pause", "--by", "live-test"]);
          const paused = yield* ImportCommand.status;
          yield* cli(["resume", "--by", "live-test"]);
          yield* cli(["status"]);

          return paused;
        }).pipe(
          Effect.provide(Layer.merge(fake.layer, Deployment.layer)),
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env })),
        );

        expect({
          events: yield* fake.events,
          job: lines.find((line) => line.startsWith("job")),
          paused: lines.find((line) => line.startsWith("paused")),
        }).toEqual({
          events: [],
          job: "job         registered",
          paused: expect.stringContaining("by live-test since"),
        });
      }),
    );
  });
});

describe("ImportJob.registration", () => {
  const credentials = {
    WEBUNTIS_SCHOOL_LOGIN_NAME: "erfundene-schule",
    WEBUNTIS_SERVER_URL: "https://webuntis.invalid",
    WEBUNTIS_USERNAME: "konto-a",
    WEBUNTIS_PASSWORD: "erfunden",
  };

  const registered = (environment: System.Environment, env: Record<string, string>) =>
    ImportJob.registration.pipe(
      Effect.map(ImportJob.describe),
      Effect.provideService(Deployment.Current, { revision: "test", environment }),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env })),
    );

  it.effect("runs only on beta and only with credentials", () =>
    Effect.gen(function* () {
      expect([
        yield* registered("beta", {}),
        yield* registered("beta", credentials),
        yield* registered("production", credentials),
        yield* registered("development", credentials),
        yield* registered("preview", credentials),
        yield* registered("beta", { ...credentials, STUDIENBUCH_JOBS: "heartbeat" }),
      ]).toEqual([
        "not registered: no WebUntis credentials",
        "registered",
        "not registered: only beta imports, and this is production",
        "not registered: only beta imports, and this is development",
        "not registered: only beta imports, and this is preview",
        "not registered: STUDIENBUCH_JOBS leaves it out",
      ]);
    }),
  );
});
