import { assert, describe, it } from "@effect/vitest";
import * as Option from "effect/Option";
import { Environments } from "./environments.ts";

describe("Environments.of", () => {
  it("gives each stage its service, host, bucket and database policy", () => {
    const cases = [
      [
        "pr-12",
        "studienbuch-pr-12",
        "pr-12.studienbuch.schnau.dev",
        "tailnet",
        "previews",
        "pr-12/",
        true,
      ],
      ["beta", "studienbuch-beta", "beta.studienbuch.app", "public", "beta", "", false],
      ["prod", "studienbuch", "studienbuch.app", "public", "prod", "", false],
    ] as const;

    for (const [stage, service, hostName, visibility, storage, blobPrefix, dropDatabase] of cases) {
      const environment = Option.getOrThrow(Environments.of(stage));
      assert.deepStrictEqual(
        [environment.service, environment.hostName, environment.visibility],
        [service, hostName, visibility],
      );
      assert.deepStrictEqual(
        [environment.storage, environment.blobPrefix, environment.dropDatabase],
        [storage, blobPrefix, dropDatabase],
      );
    }
  });

  it("lets a seventh preview wait for one of six running previews, but redeploys a running one", () => {
    const stages = ["beta", "pr-3", "pr-4", "pr-5", "pr-6", "pr-7", "pr-9"];

    assert.deepStrictEqual(
      Environments.noRoomFor("pr-12", stages),
      Option.some(
        "6 previews are running (pr-3, pr-4, pr-5, pr-6, pr-7, pr-9); close a PR or wait",
      ),
    );
    assert.isTrue(Option.isNone(Environments.noRoomFor("pr-7", stages)));
    assert.isTrue(Option.isNone(Environments.noRoomFor("pr-12", stages.slice(0, 6))));
  });

  it("knows no stage besides beta, prod and a pull request's", () => {
    for (const stage of [
      "pr-",
      "pr-0",
      "pr-012",
      "pr-1a",
      "pr-1-2",
      "Beta",
      "staging",
      "live_ci",
    ]) {
      assert.isTrue(Option.isNone(Environments.of(stage)), stage);
    }
  });
});
