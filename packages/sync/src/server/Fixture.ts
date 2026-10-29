/**
 * A small definition in the shape of M1's domain, and a fresh PostgreSQL 18 database with the
 * engine's tables, for the server engine's tests.
 */
import { PgClient } from "@effect/sql-pg";
import { CryptoSuite, SealedRow, SpaceKey } from "@stu/e2ee";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as TestCrypto from "effect/testing/TestCrypto";
import { Sync } from "../definition/Sync.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Tx } from "../transaction/Tx.ts";
import { Listener } from "./Listener.ts";
import { Ports } from "./Ports.ts";
import { ServerDatabase } from "./ServerDatabase.ts";
import { Spaces } from "./Spaces.ts";
import { SyncServer } from "./SyncServer.ts";
import { SyncWriter } from "./SyncWriter.ts";

export * as Fixture from "./Fixture.ts";

/** A guest reads a notebook and may write none of its tables. */
export const Notebook = Sync.spaceKind("notebook", {
  encryption: "sealed",
  roles: ["owner", "guest"],
});

export const School = Sync.spaceKind("school", {
  encryption: "none",
  roles: ["reader"],
  writtenBy: "server",
});

export const Course = Sync.spaceKind("course", {
  encryption: "none",
  roles: ["reader"],
  writtenBy: "server",
});

export const Homework = Sync.table("Homework", {
  class: "encrypted",
  fields: { title: Schema.String },
  writableBy: { notebook: ["owner"] },
});

export const Enrollment = Sync.table("Enrollment", {
  class: "readable",
  fields: { termId: Schema.String, courseIds: Schema.Array(Schema.String) },
  writableBy: { notebook: ["owner"] },
});

/** A term of a school, in the School space. */
export const Term = Sync.table("Term", { class: "readable", fields: { name: Schema.String } });

/**
 * A course a school offers, in the School space. Its id is the key of its Course space, which is
 * created under the school with `{ parent: school, key: id }`.
 */
export const Offering = Sync.table("Offering", {
  class: "readable",
  fields: { name: Schema.String },
});

export const Lesson = Sync.table("Lesson", {
  class: "readable",
  fields: { room: Schema.String, day: Schema.String, note: Schema.optional(Schema.String) },
  indexes: ["day"],
});

export class UnknownTerm extends Schema.TaggedError<
  UnknownTerm,
  { readonly brand: unique symbol }
>()("Enrollment.UnknownTerm", { termId: Schema.String }) {}

export class UnknownCourse extends Schema.TaggedError<
  UnknownCourse,
  { readonly brand: unique symbol }
>()("Enrollment.UnknownCourse", { courseId: Schema.String }) {}

/** Chooses the courses of a term, which the student's school must offer. */
export const setEnrollment = Sync.mutator("enrollment.set", {
  version: 1,
  args: Schema.Struct({
    notebook: Schema.String,
    school: Schema.String,
    termId: Schema.String,
    courseIds: Schema.Array(Schema.String),
  }),
  error: Schema.Union([UnknownTerm, UnknownCourse]),
  writes: [Enrollment],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Fixture.setEnrollment")(function* (args) {
    const tx = yield* Tx.Service;

    if (Option.isNone(yield* tx.get(Term, args.school, args.termId))) {
      return yield* new UnknownTerm({ termId: args.termId });
    }

    for (const courseId of args.courseIds) {
      if (Option.isNone(yield* tx.get(Offering, args.school, courseId))) {
        return yield* new UnknownCourse({ courseId });
      }
    }

    yield* tx.put(Enrollment, args.notebook, args.termId, {
      termId: args.termId,
      courseIds: args.courseIds,
    });
  }),
});

/** Creates the term's enrollment once. A second call is refused as `Tx.RowExists` on the server. */
export const createEnrollment = Sync.mutator("enrollment.create", {
  version: 1,
  args: Schema.Struct({ notebook: Schema.String, termId: Schema.String }),
  writes: [Enrollment],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Fixture.createEnrollment")(function* (args) {
    const tx = yield* Tx.Service;
    yield* tx.insert(Enrollment, args.notebook, args.termId, {
      termId: args.termId,
      courseIds: [],
    });
  }),
});

/** Dies, as a mutator with a bug does. */
export const crash = Sync.mutator("enrollment.crash", {
  version: 1,
  args: Schema.Struct({ notebook: Schema.String }),
  writes: [Enrollment],
  spaces: (args) => [args.notebook],
  run: () => Effect.die("The fixture's mutator crashed"),
});

export const createHomework = Sync.mutator("homework.create", {
  version: 1,
  args: Schema.Struct({ notebook: Schema.String, id: Schema.String, title: Schema.String }),
  writes: [Homework],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Fixture.createHomework")(function* (args) {
    const tx = yield* Tx.Service;
    yield* tx.insert(Homework, args.notebook, args.id, { title: args.title });
  }),
});

export const courses = Sync.membershipRule({
  kind: Course,
  role: "reader",
  from: Enrollment,
  spaces: (rows) => rows.flatMap(({ row }) => row.courseIds),
});

export const definition = Sync.schema({
  version: 1,
  spaceKinds: [Notebook, School, Course],
  tables: [Homework, Enrollment, Term, Offering, Lesson],
  mutators: [setEnrollment, createEnrollment, crash, createHomework],
  membership: [courses],
});

/** A database of its own on the run's PostgreSQL 18, with the engine's tables. */
export const database = Layer.effectDiscard(ServerDatabase.create).pipe(
  Layer.provideMerge(Postgres18.database(Postgres18.socket ?? "")),
);

/**
 * Sessions by bearer token, which a test adds and revokes, as Better Auth's do. Tokens are
 * `Bearer <session id>`.
 */
export class Sessions extends Context.Service<
  Sessions,
  {
    readonly add: (session: Ports.ResolvedSession) => Effect.Effect<void>;
    readonly revoke: (sessionId: string) => Effect.Effect<void>;
    /** Ends a session unannounced, as a delete in SQL or on another server process does. */
    readonly forget: (sessionId: string) => Effect.Effect<void>;
    /** Makes resolving die while `down`, as Better Auth's rejected promise does. */
    readonly outage: (down: boolean) => Effect.Effect<void>;
  }
>()("@stu/sync/server/Fixture/Sessions") {}

export const sessions = Layer.effectContext(
  Effect.gen(function* () {
    const known = new Map<string, Ports.ResolvedSession>();
    const revoked = yield* PubSub.unbounded<string>();
    let down = false;

    return Context.make(
      Sessions,
      Sessions.of({
        add: (session) => Effect.sync(() => known.set(session.sessionId, session)),
        revoke: (sessionId) =>
          Effect.andThen(
            Effect.sync(() => known.delete(sessionId)),
            PubSub.publish(revoked, sessionId),
          ),
        forget: (sessionId) => Effect.sync(() => known.delete(sessionId)),
        outage: (now) =>
          Effect.sync(() => {
            down = now;
          }),
      }),
    ).pipe(
      Context.add(
        Ports.SessionResolver,
        Ports.SessionResolver.of({
          resolve: (headers) =>
            down
              ? Effect.die("The session store is down")
              : Effect.succeed(
                  Option.flatMapNullishOr(Option.fromNullishOr(headers.authorization), (value) =>
                    known.get(value.replace(/^Bearer /, "")),
                  ),
                ),
          revoked: Stream.fromPubSub(revoked),
        }),
      ),
    );
  }),
);

/** Tickets from a seeded generator, so a run repeats. */
export const crypto = TestCrypto.layer("fixture").pipe(
  Layer.provide(
    Layer.succeed(
      Crypto.Crypto,
      Crypto.make({
        randomBytes: (size) => new Uint8Array(size),
        digest: () => Effect.die("unused"),
      }),
    ),
  ),
);

/** The whole engine over {@link database}, with test sessions. */
export const serverWith = (options?: SyncServer.Options) =>
  SyncServer.layer(definition, options).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        sessions,
        crypto,
        Listener.layer(PgClient.PgClient, (notification) => notification.payload),
      ),
    ),
    Layer.provideMerge(database),
  );

export const server = serverWith();

/** The ids of one test's school: its own spaces and accounts, so tests share a database. */
export const school = Effect.fn("Fixture.school")(function* (name: string) {
  const spaces = yield* Spaces.Service;
  const writer = yield* SyncWriter.Service;

  const ids = {
    school: `${name}-school`,
    term: "term-1",
    /** Course ids among the school's rows, which repeat across schools. */
    courses: ["ma", "de"],
    /** The Course space of each course. */
    courseSpace: (course: string) => `${name}-${course}`,
    lena: { account: `${name}-lena`, notebook: `${name}-lena-notebook` },
    tom: { account: `${name}-tom`, notebook: `${name}-tom-notebook` },
  };

  yield* spaces.create(ids.school, School);
  yield* writer.reconcile(ids.school, Term, [{ id: ids.term, row: { name: "1. Halbjahr" } }]);

  yield* writer.reconcile(
    ids.school,
    Offering,
    ids.courses.map((id) => ({ id, row: { name: id } })),
  );

  for (const course of ids.courses) {
    yield* spaces.create(ids.courseSpace(course), Course, { parent: ids.school, key: course });
  }

  for (const student of [ids.lena, ids.tom]) {
    yield* spaces.create(student.notebook, Notebook, { parent: ids.school });
    yield* spaces.addMember(student.notebook, student.account, "owner");
    yield* spaces.addMember(ids.school, student.account, "reader");
  }

  return ids;
});

/** A sealed row's envelope by `author` under `keyEpoch`. */
export const envelope = (
  author: string,
  keyEpoch = 0,
  format = SealedRow.format,
  suite = CryptoSuite.id,
) => new SealedRow.Envelope({ format, suite, keyEpoch, author });

/** A key box that opens `keyEpoch` of `space` for `recipient`. The server never opens it. */
export const keyBox = (
  space: string,
  recipient: string,
  author = recipient,
  keyEpoch = 0,
  format = SpaceKey.format,
) =>
  new SpaceKey.KeyBox({
    format,
    suite: CryptoSuite.id,
    space,
    keyEpoch,
    recipient,
    recipientGeneration: 0,
    author,
    authorGeneration: 0,
    enc: new Uint8Array(32),
    ct: new Uint8Array(48),
    signature: new Uint8Array(64),
  });

/** A history link that holds epoch `keyEpoch - 1`'s key under `keyEpoch`'s. */
export const historyLink = (
  space: string,
  author: string,
  keyEpoch = 1,
  format = SpaceKey.format,
) =>
  new SpaceKey.HistoryLink({
    format,
    suite: CryptoSuite.id,
    space,
    keyEpoch,
    author,
    authorGeneration: 0,
    ct: new Uint8Array(60),
    signature: new Uint8Array(64),
  });
