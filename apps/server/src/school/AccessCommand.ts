/**
 * `console access`: an operator admits an account to a school directly, and mints, lists and
 * revokes the school's access codes. `admit` finds the account by `--email`, or by `--account` for
 * an account without an address, and with `--grade` and `--course` chooses those courses for
 * today's term.
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

/** No account has the address or the id. */
export class UnknownAccount extends Schema.TaggedError<
  UnknownAccount,
  { readonly brand: unique symbol }
>()("AccessCommand.UnknownAccount", { account: Schema.String }) {}

/** `admit` names the account by `--email` or by `--account`, and not both. */
export class AccountRequired extends Schema.TaggedError<
  AccountRequired,
  { readonly brand: unique symbol }
>()("AccessCommand.AccountRequired", {}) {}

/** Courses need a grade level, and a term that holds today. */
export class NoChoice extends Schema.TaggedError<NoChoice, { readonly brand: unique symbol }>()(
  "AccessCommand.NoChoice",
  { reason: Schema.String },
) {}

const decodeGradeLevel = Schema.decodeUnknownEffect(School.GradeLevel);

const decodeCourses = Schema.decodeUnknownEffect(Schema.Array(Course.Id));

const admit = Effect.fn("AccessCommand.admit")(
  function* (options: {
    readonly email: Option.Option<string>;
    readonly account: Option.Option<string>;
    readonly school: string;
    readonly grade: Option.Option<number>;
    readonly course: ReadonlyArray<string>;
  }) {
    const sql = yield* SqlClient.SqlClient;

    if (Option.isSome(options.email) === Option.isSome(options.account)) {
      return yield* new AccountRequired();
    }

    const named = Option.getOrElse(
      Option.orElse(options.email, () => options.account),
      () => "",
    );

    const [found] = yield* Option.isSome(options.email)
      ? sql<{ readonly id: string }>`select id from auth_user where lower(email) = lower(${named})`
      : sql<{ readonly id: string }>`select id from auth_user where id = ${named}`;

    if (found === undefined) return yield* new UnknownAccount({ account: named });

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
        ? `Admitted ${named} to ${options.school}, notebook ${admitted.notebook}`
        : `${named} already has access to ${options.school}, notebook ${admitted.notebook}`,
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

const decodeUses = Schema.decodeUnknownEffect(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)));

const createCode = Effect.fn("AccessCommand.createCode")(function* (options: {
  readonly school: string;
  readonly kind: string;
  readonly uses: number;
  readonly expires: Option.Option<string>;
}) {
  const minted = yield* AccessCodes.mint({
    school: yield* schoolOf(options.school),
    kind: yield* decodeKind(options.kind),
    maxUses: yield* decodeUses(options.uses),
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
    const uses = `${code.uses}/${code.maxUses}`;
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
        uses: Flag.Int("uses"),
        expires: Flag.String("expires").pipe(Flag.optional),
      },
      createCode,
    ).pipe(
      Command.withDescription(
        "Prints a new code for --uses admissions, such as a class's size and a margin",
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
        email: Flag.String("email").pipe(Flag.optional),
        account: Flag.String("account").pipe(Flag.optional),
        school: Flag.String("school"),
        grade: Flag.Int("grade").pipe(Flag.optional),
        course: Flag.String("course").pipe(Flag.atLeast(0)),
      },
      admit,
    ).pipe(
      Command.withDescription(
        "Admits the account of --email or --account to the school with a notebook there, and the courses for today's term",
      ),
    ),
    codes,
  ]),
);
