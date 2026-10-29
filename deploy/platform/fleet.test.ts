import { assert, describe, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { Environments } from "../environments.ts";
import * as Platform from "./fleet.ts";

const release = {
  revision: "8f3c2a1e",
  bundle: "/nix/store/aaaa-studienbuch-bundle",
  node: "/nix/store/bbbb-nodejs-slim-26",
};
const storage = { endpoint: "https://account.eu.r2.cloudflarestorage.com", bucket: "bucket" };
const environment = (stage: string) => Option.getOrThrow(Environments.of(stage));

describe("Platform.spec", () => {
  it("runs a preview on the Tailnet with captured mail and a database that goes with it", () => {
    const generated = { AUTH_SECRET: Redacted.make("a"), DEMO_KEY_SEED: Redacted.make("b") };

    assert.deepStrictEqual(Platform.spec(environment("pr-7"), release, storage, generated), {
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
        MAIL_FROM: "Studienbuch <konto@studienbuch.app>",
        MAIL_URL: "capture:",
        S3_ENDPOINT: storage.endpoint,
        S3_REGION: "auto",
        S3_BUCKET: "bucket",
        S3_PREFIX: "pr-7/",
        S3_FORCE_PATH_STYLE: "true",
      },
      secrets: {
        ...generated,
        S3_ACCESS_KEY_ID: { sops: "projects/studienbuch/r2/previews/access-key-id" },
        S3_SECRET_ACCESS_KEY: { sops: "projects/studienbuch/r2/previews/secret-access-key" },
      },
      memory: { max: "512M" },
    });
  });

  it("keeps beta's database and reads its mail, demo password and keys from SOPS", () => {
    const beta = environment("beta");
    const spec = Platform.spec(beta, release, storage, Platform.sopsSecrets(beta));

    assert.deepStrictEqual(spec.database, {
      env: "DATABASE_URL",
      majorVersion: 18,
      dropOnDelete: false,
    });
    assert.deepStrictEqual(spec.secrets, {
      AUTH_SECRET: { sops: "projects/studienbuch/beta/auth-secret" },
      DEMO_KEY_SEED: { sops: "projects/studienbuch/beta/demo-key-seed" },
      MAIL_URL: { sops: "projects/studienbuch/beta/mail-url" },
      DEMO_PASSWORD: { sops: "projects/studienbuch/beta/demo-password" },
      S3_ACCESS_KEY_ID: { sops: "projects/studienbuch/r2/beta/access-key-id" },
      S3_SECRET_ACCESS_KEY: { sops: "projects/studienbuch/r2/beta/secret-access-key" },
    });
    assert.isFalse("MAIL_URL" in spec.env);
    assert.deepStrictEqual(
      [spec.env.STUDIENBUCH_ENVIRONMENT, spec.env.PASSKEY_RP_ID, spec.env.S3_PREFIX],
      ["beta", "beta.studienbuch.app", ""],
    );
    assert.deepStrictEqual(JSON.parse(spec.env.STUDIENBUCH_NATIVE_APPS ?? "null"), {
      ios: ["2243J9RD68.dev.schnau.studienbuch"],
      android: [],
    });
  });
});
