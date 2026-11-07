import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Fixture } from "../testing/Fixture.ts";
import type { MemoryTx } from "../testing/MemoryTx.ts";
import { NotebookProfile } from "./NotebookProfile.ts";

const { notebook } = Fixture;

const stored = (db: MemoryTx.Database) =>
  Option.getOrUndefined(db.stored(notebook, NotebookProfile.Row.name, notebook));

describe("notebookProfile.set", () => {
  it.effect("writes the name and whether the student is an adult under the notebook's id", () =>
    Effect.gen(function* () {
      const db = yield* Fixture.make;

      yield* Fixture.run(db, NotebookProfile.set, {
        notebook,
        displayName: NotebookProfile.DisplayName.make("Lena"),
        adult: false,
      });

      expect(stored(db)).toEqual({ displayName: "Lena", adult: false });
    }),
  );

  it.effect("changes both on a second set and keeps a newer app's field", () =>
    Effect.gen(function* () {
      const db = yield* Fixture.make;

      yield* db.seed(notebook, NotebookProfile.Row.name, notebook, {
        displayName: "Lena",
        adult: false,
        avatar: { hash: "abc", type: "image/jpeg" },
      });

      yield* Fixture.run(db, NotebookProfile.set, {
        notebook,
        displayName: NotebookProfile.DisplayName.make("Lena M."),
        adult: true,
      });

      expect(stored(db)).toEqual({
        displayName: "Lena M.",
        adult: true,
        avatar: { hash: "abc", type: "image/jpeg" },
      });
    }),
  );
});
