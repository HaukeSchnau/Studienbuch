import { assert, it } from "@effect/vitest";

import { Names } from "./Names.ts";

const one = new URL("https://one.example");
const two = new URL("https://two.example");

it("an account's database and secrets are its own per server, device and account", () => {
  for (const name of [Names.database, Names.secrets]) {
    const names = [
      name(one, "browser", "lena"),
      name(two, "browser", "lena"),
      name(one, "a", "lena"),
      name(one, "browser", "tom"),
      // The parts can't run into each other.
      name(one, "browser-", "lena"),
      name(one, "browser", "-lena"),
    ];

    assert.strictEqual(new Set(names).size, names.length);
    assert.strictEqual(name(new URL("https://one.example/app/"), "browser", "lena"), names[0]);
  }

  assert.match(Names.database(one, "browser", "lena"), /^account-[0-9a-f]{32}$/u);
});

it("a device's own entries are its own per server and device", () => {
  assert.notStrictEqual(Names.device(one, "a"), Names.device(one, "b"));
  assert.notStrictEqual(Names.device(one, "a"), Names.device(two, "a"));
  assert.notStrictEqual(Names.device(one, "a"), Names.secrets(one, "a", ""));
});
