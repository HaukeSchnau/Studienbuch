import { describe, expect, it } from "@effect/vitest";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { Protocol } from "../protocol/Protocol.ts";
import { Contract } from "./Contract.ts";

// Every tag is version 1 today, so the gate is shown on a table with one tag of a later version.
const since = { Applied: 1, Later: 2, "Sync.Later": 2 };
const minimum = { protocol: 1, schema: 2 };
const client = (protocol: number) => ({ protocol, schema: 2, hash: "build" });

/** An error of a later protocol than the client's. */
class Later extends Data.TaggedError("Sync.Later")<{}> {}

describe("Contract.sendable", () => {
  it.effect(
    "answers UpdateRequired with both minimums when a response holds a tag the client can't decode",
    () =>
      Effect.gen(function* () {
        const answer = (protocol: number, tags: ReadonlyArray<string>) =>
          Contract.sendable(client(protocol), minimum, tags, since).pipe(
            Effect.as("sent"),
            Effect.catchTags({ "Sync.UpdateRequired": (error) => Effect.succeed(error) }),
          );

        expect([
          yield* answer(1, ["Applied", "Later"]),
          yield* answer(2, ["Applied", "Later"]),
          // A mutator's own refusal tag travels in an open record that every version decodes.
          yield* answer(1, ["Applied", "Homework.CourseNotChosen"]),
          // An error the client can't decode is answered the same way.
          yield* Contract.failSendable(Effect.fail(new Later()), client(1), minimum, since).pipe(
            Effect.catchTags({ "Sync.UpdateRequired": (error) => Effect.succeed(error) }),
          ),
        ]).toEqual([
          new Protocol.UpdateRequired({ minimum: { protocol: 2, schema: 2 } }),
          "sent",
          "sent",
          new Protocol.UpdateRequired({ minimum: { protocol: 2, schema: 2 } }),
        ]);
      }),
  );
});
