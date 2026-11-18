import { Course, Notebook, SchoolClass, SchoolYear, Term } from "@stu/core";
import { assert, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { Onboarding } from "../onboarding/Onboarding.ts";
import { Profile } from "./Profile.ts";

const term = Term.Id.make("winter");

const choices = (classId?: string): Onboarding.TermChoices => ({
  id: term,
  classes: [
    {
      id: SchoolClass.Id.make("c11"),
      schoolYearId: SchoolYear.Id.make("2026"),
      name: "11c",
      gradeLevel: 11,
    },
  ],
  offerings: [],
  courses: new Map(),
  subjects: new Map(),
  enrollment: Option.some({
    termId: term,
    gradeLevel: 11,
    classId: classId === undefined ? undefined : SchoolClass.Id.make(classId),
    courseIds: [Course.Id.make("ma")],
  }),
});

const ready = (
  snapshot: Partial<Pick<Onboarding.Snapshot, "profile" | "term" | "schoolName">>,
): AsyncResult.AsyncResult<Onboarding.Reading, unknown> =>
  AsyncResult.success(
    Onboarding.Reading.Ready({
      snapshot: {
        id: Notebook.Id.make("n"),
        schoolName: "Demoschule am Wiesengrund",
        profile: { displayName: "Lena Beispiel" },
        term: Option.some(choices("c11")),
        refused: Option.none(),
        ...snapshot,
      },
    }),
  );

const shown = (reading: AsyncResult.AsyncResult<Onboarding.Reading, unknown>) => {
  const facts = Profile.facts(reading);

  return {
    name: Option.getOrUndefined(facts.name),
    school: Option.getOrUndefined(facts.school),
    placement: Option.getOrUndefined(Profile.placement(facts)),
  };
};

it("shows only what the device holds of who the student is", () => {
  const rows = [
    [ready({}), "Lena Beispiel", "Demoschule am Wiesengrund", "Jahrgang 11, Klasse 11c"],
    [
      ready({ term: Option.some(choices()) }),
      "Lena Beispiel",
      "Demoschule am Wiesengrund",
      "Jahrgang 11",
    ],
    // Between terms there is no course choice, so no Jahrgang either.
    [ready({ term: Option.none() }), "Lena Beispiel", "Demoschule am Wiesengrund", undefined],
    // A locked device can't read the encrypted name.
    [ready({ profile: {} }), undefined, "Demoschule am Wiesengrund", "Jahrgang 11, Klasse 11c"],
    [
      ready({ profile: { displayName: "  " }, schoolName: "" }),
      undefined,
      undefined,
      "Jahrgang 11, Klasse 11c",
    ],
    [AsyncResult.success(Onboarding.Reading.NoSchool()), undefined, undefined, undefined],
    [AsyncResult.initial(), undefined, undefined, undefined],
  ] as const;

  for (const [reading, name, school, placement] of rows) {
    assert.deepStrictEqual(shown(reading), { name, school, placement });
  }
});

it("takes the initials from the first and the last word", () => {
  assert.deepStrictEqual(
    ["Lena Beispiel", "lena", " Anna-Lena  von Beispiel ", "Émile Zoë"].map(Profile.initials),
    ["LB", "L", "AB", "ÉZ"],
  );
});
