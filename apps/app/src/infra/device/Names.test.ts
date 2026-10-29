import { assert, it } from "@effect/vitest";

import { Names } from "./Names.ts";

const beta = new URL("https://one.example");
const preview = new URL("https://two.example");

it("an account's database is its own per server, device and account, and keeps its name", () => {
  const names = [
    Names.database(beta, "browser", "lena"),
    Names.database(preview, "browser", "lena"),
    Names.database(beta, "a", "lena"),
    Names.database(beta, "browser", "tom"),
    // The parts can't run into each other.
    Names.database(beta, "browser-", "lena"),
    Names.database(beta, "browser", "-lena"),
  ];

  assert.strictEqual(new Set(names).size, names.length);
  assert.strictEqual(
    Names.database(new URL("https://one.example/app/"), "browser", "lena"),
    names[0],
  );
  assert.match(names[0] ?? "", /^account-[0-9a-f]{32}$/u);
});

it("a device's secrets are its own per server and device", () => {
  assert.notStrictEqual(Names.secrets(beta, "a"), Names.secrets(beta, "b"));
  assert.notStrictEqual(Names.secrets(beta, "a"), Names.secrets(preview, "a"));
  assert.strictEqual(
    Names.secrets(beta, "a"),
    Names.secrets(new URL("https://one.example/x"), "a"),
  );
});
