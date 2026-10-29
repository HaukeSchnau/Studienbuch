/**
 * `console access admit`: an operator admits an account to a school, until access codes arrive in
 * M3. With `--grade` and `--course`, the account chooses those courses for today's term.
 */
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
  ]),
);
