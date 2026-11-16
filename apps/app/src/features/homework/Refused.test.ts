import { assert, describe, it } from "@effect/vitest";
import { CivilTime, Homework, Notebook } from "@stu/core";
import * as Schema from "effect/Schema";

import { Refused } from "./Refused.ts";

const notebook = Notebook.Id.make("notebook-lena");
const id = Homework.Id.make("1b4e28ba-2fa1-41d2-883f-0016d3cca427");
const titles = new Map([[id, "Vocabulary Unit 4 lernen"]]);
const today = Schema.decodeSync(CivilTime.PlainDate)("2026-11-16");

// The args as the outbox stores them: encoded by the mutator's own JSON codec.
const encodeSetDone = Schema.encodeSync(Homework.setDone.args);
const encodeUpdate = Schema.encodeSync(Homework.update.args);

describe("Refused.change", () => {
  it.each([
    [
      "a tick",
      Homework.setDone.name,
      encodeSetDone({ notebook, id, doneOn: today }),
      "Abgehakt: Vocabulary Unit 4 lernen",
    ],
    [
      "a reopen, whose absent doneOn is stored as null",
      Homework.setDone.name,
      encodeSetDone({ notebook, id, doneOn: undefined }),
      "Wieder geöffnet: Vocabulary Unit 4 lernen",
    ],
    [
      "an update without a title",
      Homework.update.name,
      encodeUpdate({ notebook, id, title: undefined }),
      "Geändert: Vocabulary Unit 4 lernen",
    ],
  ])("names the homework for %s", (_, name, args, line) => {
    assert.strictEqual(Refused.change({ name, args }, titles), line);
  });
});
