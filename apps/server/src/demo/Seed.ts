/**
 * The demo seed: the demo school for the current school year, and Lena and Tom admitted to it with
 * their courses for today's term. `prepare` runs it when `STUDIENBUCH_DEMO_SCHOOL=seed`, and
 * `console demo seed` on request. A second run writes nothing, so no device pulls anything.
 */
import { Demo } from "@stu/api/Demo";
import { Studienbuch } from "@stu/core";
import { SyncServer } from "@stu/sync/server";
import * as Command from "effect/cli/Command";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Access } from "../school/Access.ts";
import { Schools } from "../school/Schools.ts";
import { DemoAccounts } from "./DemoAccounts.ts";
import { DemoKeys } from "./DemoKeys.ts";
import { DemoSchool } from "./DemoSchool.ts";

export * as Seed from "./Seed.ts";

/**
 * Seeds the demo school and its personas, or brings them to today's school year and term. It needs
 * `DemoAccounts.Seeding`, which only `prepare` and the console provide.
 */
export const run = Effect.gen(function* () {
  const password = yield* DemoAccounts.password;
  // The personas' root keys derive from it, so a seed without it would leave them locked out.
  yield* DemoKeys.seed;

  return yield* Effect.gen(function* () {
    const school = yield* DemoSchool.data(yield* Schools.today(DemoSchool.timeZone));
    const term = school.year.current.id;
    yield* Schools.publish(school.data);

    for (const persona of Demo.Persona.literals) {
      const { account, notebook } = DemoSchool.personas[persona];
      const choice = DemoSchool.choice(DemoSchool.personas[persona], term);
      yield* DemoAccounts.ensure(persona, password);
      yield* Access.admit(account, DemoSchool.id, Option.some(choice), notebook);
      // A term that began since the last seed gets the persona's courses again.
      yield* Access.enroll(notebook, choice);
    }

    return { school: DemoSchool.id, term };
  }).pipe(
    // The seed's own rows, which `enrollment.set` accepts.
    Effect.orDie,
    Effect.provide(SyncServer.writers(Studienbuch.schema)),
  );
}).pipe(Effect.withSpan("Seed.run"));

/** What `prepare` runs: the seed when `STUDIENBUCH_DEMO_SCHOOL=seed`, and nothing otherwise. */
export const whenEnabled = Effect.gen(function* () {
  const enabled = yield* Config.option(Config.Literal("seed", "STUDIENBUCH_DEMO_SCHOOL"));

  if (Option.isNone(enabled)) return;

  const seeded = yield* run;
  yield* Effect.logInfo(`Seeded ${seeded.school} for ${seeded.term}`);
});

export const command = Command.make("demo").pipe(
  Command.withDescription("The demo school"),
  Command.withSubcommands([
    Command.make("seed", {}, () =>
      Effect.flatMap(run, (seeded) =>
        Console.log(`Seeded ${seeded.school} with Lena and Tom for ${seeded.term}`),
      ),
    ).pipe(Command.withDescription("Seeds the demo school, or brings it to today's term")),
  ]),
);
