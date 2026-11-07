/**
 * `console access`: an operator admits an account to a school directly, and mints, lists and
 * revokes the school's access codes. `admit` with `--grade` and `--course` chooses those courses
 * for today's term.
 */
import { Access as Api } from "@stu/api/Access";
import { Course, School, Studienbuch } from "@stu/core";
import { SyncServer } from "@stu/sync/server";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Access } from "./Access.ts";
import { AccessCodes } from "./AccessCodes.ts";
import { Schools } from "./Schools.ts";

export * as AccessCommand from "./AccessCommand.ts";

/** No account has the address. */
export class UnknownEmail extends Schema.TaggedError<
  UnknownEmail,
  { readonly brand: unique symbol }
>()("AccessCommand.UnknownEmail", { email: Schema.String }) {}

/** Courses need a grade level, and a term that holds today. */
export class NoChoice extends Schema.TaggedError<NoChoice, { readonly brand: unique symbol }>()(
  "AccessCommand.NoChoice",
  { reason: Schema.String },
) {}

const decodeGradeLevel = Schema.decodeUnknownEffect(School.GradeLevel);

const decodeCourses = Schema.decodeUnknownEffect(Schema.Array(Course.Id));

const admit = Effect.fn("AccessCommand.admit")(
  function* (options: {
    readonly email: string;
    readonly school: string;
    readonly grade: Option.Option<number>;
    readonly course: ReadonlyArray<string>;
  }) {
    const sql = yield* SqlClient.SqlClient;

    const [found] = yield* sql<{ readonly id: string }>`
    select id from auth_user where lower(email) = lower(${options.email})
  `;

    if (found === undefined) return yield* new UnknownEmail({ email: options.email });

    const school = School.Id.makeOption(options.school);

    if (Option.isNone(school)) return yield* new Access.UnknownSchool({ school: options.school });

    let choice = Option.none<Schools.Choice>();

    if (options.course.length > 0) {
      if (Option.isNone(options.grade)) {
        return yield* new NoChoice({ reason: "--course needs --grade" });
      }

      const term = yield* Schools.currentTerm(school.value);

      if (Option.isNone(term)) {
        return yield* new NoChoice({ reason: `${options.school} has no term that holds today` });
      }

      choice = Option.some({
        termId: term.value,
        gradeLevel: yield* decodeGradeLevel(options.grade.value),
        courseIds: yield* decodeCourses(options.course),
      });
    }

    const admitted = yield* Access.admit(found.id, school.value, choice);

    yield* Console.log(
      admitted.created
        ? `Admitted ${options.email} to ${options.school}, notebook ${admitted.notebook}`
        : `${options.email} already has access to ${options.school}, notebook ${admitted.notebook}`,
    );
  },
  Effect.provide(SyncServer.writers(Studienbuch.schema)),
);

/** The school doesn't exist, so it has no codes to make. */
export class UnknownSchool extends Schema.TaggedError<
  UnknownSchool,
  { readonly brand: unique symbol }
>()("AccessCommand.UnknownSchool", { school: Schema.String }) {}

const decodeKind = Schema.decodeUnknownEffect(Api.Kind);

const decodeExpiry = Schema.decodeUnknownEffect(Schema.Date);

const schoolOf = Effect.fn("AccessCommand.schoolOf")(function* (school: string) {
  const sql = yield* SqlClient.SqlClient;
  const id = School.Id.makeOption(school);

  const found = Option.isNone(id)
    ? []
    : yield* sql`select 1 from space where id = ${id.value} and kind = ${School.Space.name}`;

  if (Option.isNone(id) || found.length === 0) return yield* new UnknownSchool({ school });

  return id.value;
});

/** A code needs `--uses`, such as a class's size, or `--unlimited`, and not both. */
export class UsesRequired extends Schema.TaggedError<
  UsesRequired,
  { readonly brand: unique symbol }
>()("AccessCommand.UsesRequired", {}) {}

const decodeUses = Schema.decodeUnknownEffect(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)));

const createCode = Effect.fn("AccessCommand.createCode")(function* (options: {
  readonly school: string;
  readonly kind: string;
  readonly uses: Option.Option<number>;
  readonly unlimited: boolean;
  readonly expires: Option.Option<string>;
}) {
  // Every use mails a code to an address of the user's choosing, so a code stops somewhere.
  if (Option.isSome(options.uses) === options.unlimited) return yield* new UsesRequired();

  const minted = yield* AccessCodes.mint({
    school: yield* schoolOf(options.school),
    kind: yield* decodeKind(options.kind),
    maxUses: Option.isNone(options.uses)
      ? Option.none()
      : Option.some(yield* decodeUses(options.uses.value)),
    expiresAt: Option.isNone(options.expires)
      ? Option.none()
      : Option.some(yield* decodeExpiry(options.expires.value)),
  });

  // The only place the code is ever shown. The database keeps its hash.
  yield* Console.log(minted.code);
  yield* Console.error(`Code ${minted.id} for ${options.school}. It is shown once.`);
});

const listCodes = Effect.fn("AccessCommand.listCodes")(function* (options: {
  readonly school: string;
}) {
  const codes = yield* AccessCodes.list(yield* schoolOf(options.school));

  for (const code of codes) {
    const uses = `${code.uses}/${code.maxUses ?? "unbegrenzt"}`;
    const ends = code.expiresAt === null ? "" : ` bis ${code.expiresAt.toISOString()}`;
    const revoked = code.revokedAt === null ? "" : " widerrufen";
    yield* Console.log(`${code.id} ${code.kind} ${uses}${ends}${revoked}`);
  }
});

const revokeCode = Effect.fn("AccessCommand.revokeCode")(function* (options: {
  readonly id: string;
}) {
  const revoked = yield* AccessCodes.revoke(options.id);

  yield* Console.log(revoked ? `Revoked ${options.id}` : `${options.id} was revoked or unknown`);
});

const codes = Command.make("code").pipe(
  Command.withDescription("A school's access codes, which sign-ups start with"),
  Command.withSubcommands([
    Command.make(
      "create",
      {
        school: Flag.String("school"),
        kind: Flag.String("kind"),
        uses: Flag.Int("uses").pipe(Flag.optional),
        unlimited: Flag.Boolean("unlimited").pipe(Flag.withDefault(false)),
        expires: Flag.String("expires").pipe(Flag.optional),
      },
      createCode,
    ).pipe(
      Command.withDescription(
        "Prints a new code for --uses admissions, such as a class's size, or --unlimited ones",
      ),
    ),
    Command.make("list", { school: Flag.String("school") }, listCodes).pipe(
      Command.withDescription("The school's codes with their uses, without the codes themselves"),
    ),
    Command.make("revoke", { id: Flag.String("id") }, revokeCode).pipe(
      Command.withDescription("Ends a code for new sign-ups and unspent reservations"),
    ),
  ]),
);

export const command = Command.make("access").pipe(
  Command.withDescription("Accounts' access to schools"),
  Command.withSubcommands([
    Command.make(
      "admit",
      {
        email: Flag.String("email"),
        school: Flag.String("school"),
        grade: Flag.Int("grade").pipe(Flag.optional),
        course: Flag.String("course").pipe(Flag.atLeast(0)),
      },
      admit,
    ).pipe(
      Command.withDescription(
        "Admits the account to the school with a notebook there, and the courses for today's term",
      ),
    ),
    codes,
  ]),
);
