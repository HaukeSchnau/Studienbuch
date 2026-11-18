/**
 * The `Dev` RPC group: a fresh school per call and the caller's admission to it, for the Sync Lab
 * and E2E runs. Every server has the handlers, because one build serves every environment, and
 * only development and preview servers answer, to a signed-in account.
 */
import { Dev } from "@stu/api/Dev";
import { School, Studienbuch } from "@stu/core";
import { Ports, SyncServer } from "@stu/sync/server";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { DemoSchool } from "../demo/DemoSchool.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { Access } from "../school/Access.ts";
import { AccessCodes } from "../school/AccessCodes.ts";
import { Schools } from "../school/Schools.ts";

export * as Shortcuts from "./Shortcuts.ts";

/** The grade level a dev school offers its courses to, and the one `Dev.admit` chooses. */
const gradeLevel = 11;

const subjects = [
  { id: "ma", name: "Mathematik", shortName: "MA" },
  { id: "de", name: "Deutsch", shortName: "DE" },
  { id: "en", name: "Englisch", shortName: "EN" },
];

/**
 * A school of its own under a random id, with this school year's two terms and one course of each
 * subject offered in both, and an access code for any number of sign-ups. The answer names today's
 * term.
 */
export const createSchool = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  const bytes = yield* Effect.orDie(crypto.randomBytes(6));
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = School.Id.make(`dev-${suffix}`);
  const school = { name: `Schule ${suffix}`, timeZone: School.defaultTimeZone };

  const today = yield* Schools.today(school);
  const { data, term } = yield* Schools.simple({ id, school, today, gradeLevel, subjects });
  yield* Schools.publish(data, Schools.removeMissing(today));

  const { code } = yield* Effect.orDie(
    // One run of the end-to-end tests signs up a handful of students to its own school.
    AccessCodes.mint({ school: id, kind: "student", maxUses: 100 }),
  );

  return new Dev.School({
    id,
    termId: term,
    courseIds: subjects.map((subject) => Schools.simpleCourse(subject.id)),
    code,
  });
});

/** Admits the account with the courses the school offers today to the grade level. */
export const admit = Effect.fn("Shortcuts.admit")(function* (
  account: string,
  school: string,
  grade: School.GradeLevel,
) {
  const id = School.Id.makeOption(school);

  if (Option.isNone(id)) return yield* new Dev.UnknownSchool({ school });

  const admitted = yield* Effect.result(
    Access.admit(account, id.value, yield* Schools.offered(id.value, grade)),
  );

  if (Result.isSuccess(admitted)) return new Dev.Admission({ notebook: admitted.success.notebook });

  const refusal = admitted.failure;

  if (refusal._tag === "Access.UnknownSchool") return yield* new Dev.UnknownSchool({ school });

  if (refusal._tag === "Access.DemoAccount") return yield* new Dev.DemoAccount({ school });

  // The choice is what the school offers, which `enrollment.set` accepts.
  return yield* Effect.die(refusal);
});

export const handlers = Dev.Rpcs.toLayer(
  Effect.gen(function* () {
    const { environment } = yield* Deployment.Current;
    const sessions = yield* Ports.SessionResolver;

    /** The calling account, on a development or preview server only. */
    const caller = Effect.fn("Shortcuts.caller")(function* (headers: Headers.Headers) {
      if (!Deployment.isDevelopmentOrPreview(environment)) return yield* new Dev.Unavailable();

      const session = yield* sessions.resolve(headers);

      if (Option.isNone(session)) return yield* new Dev.SignedOut();

      return session.value.accountId;
    });

    return Dev.Rpcs.of({
      "Dev.createSchool": (_, { headers }) => Effect.andThen(caller(headers), createSchool),
      "Dev.admit": ({ school }, { headers }) =>
        Effect.flatMap(caller(headers), (account) => admit(account, school, gradeLevel)),
      "Dev.admitToDemoSchool": (_, { headers }) =>
        Effect.flatMap(caller(headers), (account) =>
          admit(account, DemoSchool.id, DemoSchool.gradeLevel),
        ),
    });
  }),
).pipe(Layer.provide(SyncServer.writers(Studienbuch.schema)));
