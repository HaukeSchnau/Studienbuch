import { assert, describe, it } from "@effect/vitest";
import { Tokens } from "./Tokens.ts";

const key = new Uint8Array(32).fill(1);

describe("Tokens", () => {
  it("gives a value the same token under the same key, and another under another key", () => {
    const first = Tokens.make(key);
    const again = Tokens.make(key);
    const other = Tokens.make(new Uint8Array(32).fill(2));

    const token = first.token("T", "id:201");

    assert.match(token, Tokens.name);
    assert.strictEqual(again.token("T", "id:201"), token);
    assert.notStrictEqual(other.token("T", "id:201"), token);
    assert.isTrue(Tokens.isId(first.id("S", 501)));
    assert.strictEqual(again.id("S", 501), first.id("S", 501));
  });

  it("tells colliding values apart, the same way in every run", () => {
    // One base32 character holds 32 tokens, so twenty values collide for certain.
    const values = Array.from({ length: 20 }, (_, index) => `id:${index}`);
    const ids = Array.from({ length: 20 }, (_, index) => index);
    const tiny = { width: 1, ids: { min: 1000, size: 25 } };

    const run = () => {
      const tokens = Tokens.make(key, tiny);

      return {
        names: values.map((value) => tokens.token("S", value)),
        ids: ids.map((id) => tokens.id("S", id)),
      };
    };

    const { names, ids: numbers } = run();

    assert.strictEqual(new Set(names).size, values.length);
    assert.strictEqual(new Set(numbers).size, ids.length);
    assert.isTrue(numbers.every((id) => id >= 1000 && id < 1025));
    assert.deepStrictEqual(run(), { names, ids: numbers });
  });
});
