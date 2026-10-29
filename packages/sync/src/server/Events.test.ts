import { describe, expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { Protocol } from "../protocol/Protocol.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Tx } from "../transaction/Tx.ts";
import { Events } from "./Events.ts";
import { Fixture } from "./Fixture.ts";
import { Spaces } from "./Spaces.ts";
import { SyncWriter } from "./SyncWriter.ts";

const isPoke = Schema.is(Protocol.Poke);

describe.skipIf(Postgres18.socket === null)("Events on PostgreSQL 18", () => {
  // The real clock, because the pokes come from Postgres and the 50 ms coalescing waits for them.
  layer(Fixture.server, { excludeTestServices: true })((it) => {
    it.effect(
      "a connection hears the pokes of its own spaces and the changes of its memberships",
      () =>
        Effect.scoped(
          Effect.gen(function* () {
            const world = yield* Fixture.school("events");
            const { lena, tom } = world;
            const writer = yield* SyncWriter.Service;
            const spaces = yield* Spaces.Service;
            const events = yield* Events.Service;
            const heard = yield* events.subscribe(lena.account, Fixture.definition.contract);
            const collected = yield* Effect.forkChild(Stream.runCollect(Stream.take(heard, 2)));

            // Tom's notebook is no space of Lena's, so its commit never reaches her connection.
            yield* writer.write(
              tom.notebook,
              [Fixture.Enrollment],
              Effect.flatMap(Tx.Service, (tx) =>
                tx.put(Fixture.Enrollment, tom.notebook, world.term, {
                  termId: world.term,
                  courseIds: [],
                }),
              ),
            );
            yield* writer.reconcile(world.school, Fixture.Lesson, [
              { id: "mon-1", row: { room: "A1", day: "mon" } },
            ]);
            yield* spaces.addMember(world.courseSpace("ma"), lena.account, "reader");
            const received = [...(yield* Fiber.join(collected))];

            expect(received.map((event) => event._tag).sort()).toEqual(["AccountChanged", "Poke"]);

            expect(
              received.flatMap((event) =>
                isPoke(event) ? event.spaces.map(({ space }) => space) : [],
              ),
            ).toEqual([world.school]);
          }),
        ),
    );
  });
});
