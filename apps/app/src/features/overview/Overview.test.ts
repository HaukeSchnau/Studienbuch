import { assert, it } from "@effect/vitest";

import { Overview } from "./Overview.ts";

const id = "5b0e5b7e-6f0c-4c62-9d55-0a4c8e3b6a10";
const homework = [{ id, title: "Vocabulary Unit 3" }];
const tick = { notebook: "0191a5d2-7c3e-7b1a-8f4e-2d6c9a1b3e5f", id };

it("shows the refusals of homework commands and leaves the course choice to the first start", () => {
  assert.deepStrictEqual(
    ["homework.setDone", "homework.create", "enrollment.set"].map((name) =>
      Overview.shows({ name }),
    ),
    [true, true, false],
  );
});

it("names a refused change by the homework's title and by what it asked for", () => {
  const describe = (args: Readonly<Record<string, string>>, name = "homework.setDone") =>
    Overview.describe({ name, args }, homework);

  assert.strictEqual(describe({ ...tick, doneOn: "2026-11-11" }), "Erledigt: Vocabulary Unit 3");
  assert.strictEqual(describe(tick), "Wieder offen: Vocabulary Unit 3");
  // Deleted on another device since, which is why the server refused it.
  assert.strictEqual(
    describe({ ...tick, id: "9d3c1f6a-2b4e-4a7d-8c5f-1e2d3c4b5a69", doneOn: "2026-11-11" }),
    "Erledigt: eine Hausaufgabe",
  );
  assert.strictEqual(
    describe({ title: "x" }, "homework.create"),
    "Eine Änderung an deinen Hausaufgaben",
  );
});
