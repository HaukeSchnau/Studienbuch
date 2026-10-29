import { assert, describe, it } from "@effect/vitest";
import * as Option from "effect/Option";
import { Environments } from "../environments.ts";
import * as Platform from "./fleet.ts";

const release = {
  revision: "8f3c2a1e",
  bundle: "/nix/store/aaaa-studienbuch-bundle",
  node: "/nix/store/bbbb-nodejs-slim-26",
};
const storage = { endpoint: "https://account.eu.r2.cloudflarestorage.com", bucket: "bucket" };
const specOf = (stage: string) =>
  Platform.spec(Option.getOrThrow(Environments.of(stage)), release, storage);

describe("Platform.spec", () => {
  it("runs a preview on the Tailnet with a database that goes with it", () => {
    assert.deepStrictEqual(specOf("pr-7"), {
      host: "srv-2",
      name: "studienbuch-pr-7",
      release: { revision: "8f3c2a1e", paths: { bundle: release.bundle, node: release.node } },
      command: ["{node}/bin/node", "{bundle}/server/main.mjs", "serve"],
      prepare: ["{node}/bin/node", "{bundle}/server/main.mjs", "prepare"],
      console: ["{node}/bin/node", "{bundle}/server/main.mjs", "console"],
      endpoint: { hostName: "pr-7.studienbuch.schnau.dev", visibility: "tailnet" },
      health: { path: "/api/health/ready" },
      database: { env: "DATABASE_URL", majorVersion: 18, dropOnDelete: true },
      env: {
        STUDIENBUCH_ENVIRONMENT: "preview",
        STUDIENBUCH_REVISION: "8f3c2a1e",
        STUDIENBUCH_DEMO_SCHOOL: "seed",
        PUBLIC_URL: "https://pr-7.studienbuch.schnau.dev",
        PASSKEY_RP_ID: "pr-7.studienbuch.schnau.dev",
        S3_ENDPOINT: storage.endpoint,
        S3_REGION: "auto",
        S3_BUCKET: "bucket",
        S3_PREFIX: "pr-7/",
        S3_FORCE_PATH_STYLE: "true",
      },
      secrets: {
        S3_ACCESS_KEY_ID: { sops: "projects/studienbuch/r2/previews/access-key-id" },
        S3_SECRET_ACCESS_KEY: { sops: "projects/studienbuch/r2/previews/secret-access-key" },
      },
      memory: { max: "512M" },
    });
  });

  it("keeps beta's database and binds beta's own bucket key", () => {
    const beta = specOf("beta");
    assert.deepStrictEqual(beta.database, {
      env: "DATABASE_URL",
      majorVersion: 18,
      dropOnDelete: false,
    });
    assert.deepStrictEqual(beta.secrets, {
      S3_ACCESS_KEY_ID: { sops: "projects/studienbuch/r2/beta/access-key-id" },
      S3_SECRET_ACCESS_KEY: { sops: "projects/studienbuch/r2/beta/secret-access-key" },
    });
    assert.deepStrictEqual(
      [beta.env.STUDIENBUCH_ENVIRONMENT, beta.env.PASSKEY_RP_ID, beta.env.S3_PREFIX],
      ["beta", "beta.studienbuch.app", ""],
    );
  });
});
