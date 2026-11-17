import { assert, it } from "@effect/vitest";
import { CivilTime, Course, Homework, Notebook, School } from "@stu/core";
import { Refusal } from "@stu/sync";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { HomeworkState } from "./HomeworkState.ts";

// A browser test only because HomeworkState's engine imports need one: `shown` itself is pure.

const notebook = Notebook.Id.make("nb-lena");
const dueOn = Schema.decodeSync(CivilTime.PlainDate)("2026-11-20");

// The args as the outbox stores them: encoded by the mutator's own JSON codec.
const encodeCreate = Schema.encodeSync(Homework.create.args);
const encodeNotMember = Schema.encodeSync(Refusal.NotMember);

/** What a device held before its notebook locked: one homework and one refused new one. */
const held: HomeworkState.Reading = {
  notebook,
  timeZone: School.defaultTimeZone,
  homework: [
    {
      id: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
      title: "Vokabeln lernen",
      description: "Unit 4",
      dueOn,
      course: "MA23",
      courseId: "c-1",
      subject: Option.none(),
      waiting: true,
    },
  ],
  refusals: [
    {
      clientId: "client-old",
      mutationId: 7,
      name: Homework.create.name,
      version: 1,
      args: encodeCreate({
        notebook,
        id: Homework.Id.make("6f9619ff-8b86-4011-b42d-00c04fc964ff"),
        courseId: Course.Id.make("c-1"),
        title: Schema.decodeSync(Homework.Title)("Referat vorbereiten"),
        dueOn,
      }),
      at: 0,
      reason: encodeNotMember(new Refusal.NotMember({ space: notebook })),
    },
  ],
  terms: [],
  enrollments: [],
  courses: new Map(),
};

it("a locked notebook shows no homework title, and its refusals return with the key", () => {
  const titles = ["Vokabeln lernen", "Unit 4", "Referat vorbereiten"];
  const locked = JSON.stringify(HomeworkState.shown(held, { readable: false, disconnected: true }));
  const unlocked = HomeworkState.shown(held, { readable: true, disconnected: true });

  for (const title of titles) assert.notInclude(locked, title);
  assert.deepStrictEqual(unlocked.refusals, held.refusals);
  assert.deepStrictEqual(unlocked.homework, held.homework);
});
