import { Database, Operator, SchoolAccess } from "@stu/server";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Command, Flag } from "effect/unstable/cli";

const name = Flag.string("name").pipe(Flag.withDescription("Operator display name"));
const userId = Flag.string("user-id").pipe(Flag.withDescription("Operator account UUID"));
const printSetup = (setup: {
  readonly token: string;
  readonly expiresAt: Date;
  readonly userId: string;
}) =>
  Effect.gen(function* () {
    const baseUrl = yield* Config.string("BETTER_AUTH_URL");
    yield* Console.log(
      JSON.stringify(
        {
          userId: setup.userId,
          expiresAt: setup.expiresAt.toISOString(),
          setupUrl: `${baseUrl.replace(/\/$/, "")}/operator/setup?token=${encodeURIComponent(setup.token)}`,
        },
        null,
        2,
      ),
    );
  });

export const operatorBootstrapCommand = Command.make("operator-bootstrap", { name }, ({ name }) =>
  Operator.bootstrap(name).pipe(Effect.flatMap(printSetup), Effect.provide(Database.layerConfig)),
).pipe(Command.withDescription("Create a passkey-only platform operator"));

export const operatorRecoverCommand = Command.make("operator-recover", { userId }, ({ userId }) =>
  Operator.recover(userId).pipe(Effect.flatMap(printSetup), Effect.provide(Database.layerConfig)),
).pipe(Command.withDescription("Issue a new passkey setup URL for an operator"));

const schoolId = Flag.string("school-id").pipe(
  Flag.withDescription("Stable school identifier, for example igs-lil"),
);
const schoolName = Flag.string("school-name").pipe(Flag.withDescription("School display name"));
const kind = Flag.choiceWithValue("kind", [
  ["student", "Student"],
  ["teacher", "Teacher"],
] as const);
const count = Flag.integer("count").pipe(Flag.withDefault(1));
const expiresAt = Flag.date("expires-at").pipe(
  Flag.optional,
  Flag.withDescription("Optional ISO expiry date"),
);
const operatorUserId = Flag.string("operator-user-id").pipe(
  Flag.withDescription("Operator UUID recorded as the issuer"),
);

export const accessCodesCommand = Command.make(
  "access-codes",
  { schoolId, schoolName, kind, count, expiresAt, operatorUserId },
  ({ schoolId, schoolName, kind, count, expiresAt, operatorUserId }) =>
    SchoolAccess.generateCodes({
      schoolId,
      schoolName,
      kind,
      count,
      createdByUserId: operatorUserId,
      expiresAt: Option.getOrUndefined(expiresAt),
    }).pipe(
      Effect.flatMap((codes) => Console.log(codes.join("\n"))),
      Effect.provide(Database.layerConfig),
    ),
).pipe(Command.withDescription("Generate an unassigned printable school access-code pool"));
