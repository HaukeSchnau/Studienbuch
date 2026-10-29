/**
 * The `Dev` RPC group: a fresh school per call and the caller's admission to it, for the Sync Lab
 * and E2E runs. Every server has the handlers, because one build serves every environment, and
 * only development and preview servers answer, to a signed-in account.
 */
import { Dev } from "@stu/api/Dev";
import { CivilTime, Course, CourseOffering, School, Studienbuch } from "@stu/core";
import { Ports, SyncServer } from "@stu/sync/server";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { DemoSchool } from "../demo/DemoSchool.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { Access } from "../school/Access.ts";
import { Schools } from "../school/Schools.ts";

export * as Shortcuts from "./Shortcuts.ts";

/** The grade level a dev school offers its courses to, and the one `Dev.admit` chooses. */
const gradeLevel = 11;

const timeZone = CivilTime.TimeZone.make("Europe/Berlin");

const subjects = {
  ma: { name: "Mathematik", shortName: "MA" },
  de: { name: "Deutsch", shortName: "DE" },
  en: { name: "Englisch", shortName: "EN" },
};

/**
 * A school of its own under a random id, with this school year's two terms and one course of each
 * subject offered in both. The answer names today's term.
 */
export const createSchool = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  const bytes = yield* Effect.orDie(crypto.randomBytes(6));
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = School.Id.make(`dev-${suffix}`);
  const year = yield* Schools.yearAround(yield* Schools.today(timeZone));

  const courses = Object.entries(subjects).map(([subjectId, subject]) => ({
    id: Course.Id.make(`${subjectId}-1`),
    row: { name: `${subject.shortName}-1`, subjectId },
  }));

  yield* Schools.publish({
    id,
    school: { name: `Schule ${suffix}`, timeZone },
    schoolYears: { [year.id]: year.row },
    terms: Object.fromEntries(year.terms.map((term) => [term.id, term.row])),
    subjects,
    classes: {},
    courses: Object.fromEntries(courses.map((course) => [course.id, course.row])),
    offerings: Object.fromEntries(
      year.terms.flatMap((term) =>
        courses.map((course) => [
          CourseOffering.idFor(course.id, term.id),
          { courseId: course.id, termId: term.id, gradeLevels: [gradeLevel], classIds: [] },
        ]),
      ),
    ),
  });

  return new Dev.School({
    id,
    termId: year.current.id,
    courseIds: courses.map((course) => course.id),
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

  const admitted = yield* Access.admit(
    account,
    id.value,
    yield* Schools.offered(id.value, grade),
  ).pipe(
    Effect.asSome,
    Effect.catchTags({ "Access.UnknownSchool": () => Effect.succeedNone }),
    // The choice is what the school offers, which `enrollment.set` accepts.
    Effect.orDie,
  );

  if (Option.isNone(admitted)) return yield* new Dev.UnknownSchool({ school });

  return new Dev.Admission({ notebook: admitted.value.notebook });
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
