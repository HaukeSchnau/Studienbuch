import { describe, expect, layer } from "@effect/vitest";
import { Access } from "@stu/api/Access";
import { School } from "@stu/core";
import { Postgres18 } from "@stu/sync/testing";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as RpcTest from "effect/rpc/RpcTest";
import * as TestClock from "effect/testing/TestClock";
import { Limits } from "../limits/Limits.ts";
import { AccessCodes } from "./AccessCodes.ts";
import { Fixture } from "./Fixture.ts";
import { Redemption } from "./Redemption.ts";
import { Schools } from "./Schools.ts";

const school = School.Id.make("am-see");

const from = (address: string) => ({ headers: { "x-forwarded-for": address } });

describe.skipIf(Postgres18.socket === null)("Redemption on PostgreSQL 18", () => {
  layer(Fixture.database)((it) => {
    it.effect(
      "an address gets its ceiling of wrong codes, and a code a few failures, per window",
      () =>
        Effect.gen(function* () {
          yield* Schools.publish({
            id: school,
            school: { name: "Schule am See", timeZone: "Europe/Berlin" },
            schoolYears: {},
            terms: {},
            subjects: {},
            classes: {},
            courses: {},
            offerings: {},
          });

          const { code } = yield* AccessCodes.mint({
            school,
            kind: "student",
            maxUses: Option.none(),
          });

          const wrong = Array.from(
            { length: Limits.perClient },
            (_, index) => `ZZZZ-ZZZZ-ZZZZ-${String(index).padStart(4, "0")}`,
          );

          // The same handlers for every call, as the server builds them once.
          return yield* Effect.gen(function* () {
            const client = yield* RpcTest.makeClient(Access.Rpcs);

            const answer = (typed: string, address: string) =>
              Effect.map(
                Effect.exit(client["Access.redeem"]({ code: typed }, from(address))),
                (exit) =>
                  exit._tag === "Success"
                    ? exit.value.schoolName
                    : exit.cause.reasons[0]?._tag === "Fail"
                      ? exit.cause.reasons[0].error._tag
                      : "defect",
              );

            const guesses = yield* Effect.forEach(wrong, (guess) => answer(guess, "10.0.0.1"));
            const blocked = yield* answer(code, "10.0.0.1");
            const elsewhere = yield* answer(code, "10.0.0.2");

            // A right code never counts, so redeeming it many times blocks nobody.
            const rights = yield* Effect.forEach(
              Array.from({ length: Redemption.failuresPerCode + 1 }, (_, index) => index),
              (index) => answer(code, `10.0.1.${index}`),
            );

            // One wrong code, tried from many addresses.
            const tries = yield* Effect.forEach(
              Array.from({ length: Redemption.failuresPerCode + 1 }, (_, index) => index),
              (index) => answer("ZZZZ-ZZZZ-ZZZZ-ZZZZ", `10.0.2.${index}`),
            );

            yield* TestClock.adjust("15 minutes");
            const later = yield* answer(code, "10.0.0.1");

            expect({
              guesses: new Set(guesses),
              blocked,
              elsewhere,
              rights: new Set(rights),
              lastTry: tries.at(-1),
              later,
            }).toEqual({
              guesses: new Set(["Access.CodeUnavailable"]),
              blocked: "Access.RateLimited",
              elsewhere: "Schule am See",
              rights: new Set(["Schule am See"]),
              lastTry: "Access.RateLimited",
              later: "Schule am See",
            });
          }).pipe(Effect.scoped, Effect.provide(Redemption.handlers));
        }),
    );
  });
});
