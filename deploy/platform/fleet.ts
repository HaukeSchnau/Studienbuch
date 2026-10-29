import * as Fleet from "@schnau/fleet";
import type { Input } from "alchemy/Input";
import type { Environment } from "../environments.ts";

/** What Calder built and deploys: the revision, the JS bundle and Node for the host's system. */
export interface Release {
  readonly revision: Input<string>;
  readonly bundle: Input<string>;
  readonly node: Input<string>;
}

/** An R2 bucket of infra's tokens stack, reached over the S3 API. */
export interface Storage {
  readonly endpoint: Input<string>;
  readonly bucket: Input<string>;
}

/** The host, whose grant lets Studienbuch run its services (infra `hosts/srv-2`). */
const host = "srv-2";

/**
 * srv-2's service controller, on 18120 because Calder's controller holds the module's default port
 * there (infra `hosts/srv-2/services.nix`). `Fleet.Service` takes another address only from
 * `FLEET_SERVICES_URL`; this goes once the module's default port no longer clashes with Calder's.
 */
export const controller = `http://${host}:18120`;

/** `studienbuch-server <command>` from the bundle, on the release's own Node. */
const server = (command: string) => ["{node}/bin/node", "{bundle}/server/main.mjs", command];

/**
 * The spec srv-2's service controller runs for an environment: the server and its database, with
 * the runtime contract's variables (hosting.md section 1). The host adds `HOST`, `PORT`,
 * `DATABASE_URL` and a `<NAME>_FILE` for each secret.
 */
export const spec = (environment: Environment, release: Release, storage: Storage) => ({
  host,
  name: environment.service,
  release: { revision: release.revision, paths: { bundle: release.bundle, node: release.node } },
  command: server("serve"),
  prepare: server("prepare"),
  console: server("console"),
  endpoint: { hostName: environment.hostName, visibility: environment.visibility },
  health: { path: "/api/health/ready" },
  database: { env: "DATABASE_URL", majorVersion: 18, dropOnDelete: environment.dropDatabase },
  env: {
    STUDIENBUCH_ENVIRONMENT: environment.kind,
    STUDIENBUCH_REVISION: release.revision,
    STUDIENBUCH_DEMO_SCHOOL: "seed",
    PUBLIC_URL: `https://${environment.hostName}`,
    PASSKEY_RP_ID: environment.hostName,
    S3_ENDPOINT: storage.endpoint,
    S3_REGION: "auto",
    S3_BUCKET: storage.bucket,
    S3_PREFIX: environment.blobPrefix,
    S3_FORCE_PATH_STYLE: "true",
  },
  secrets: {
    S3_ACCESS_KEY_ID: { sops: `projects/studienbuch/r2/${environment.storage}/access-key-id` },
    S3_SECRET_ACCESS_KEY: {
      sops: `projects/studienbuch/r2/${environment.storage}/secret-access-key`,
    },
  },
  memory: { max: environment.memory },
});

/** Studienbuch's server on srv-2. Its attributes include the host's public addresses. */
export const service = (environment: Environment, release: Release, storage: Storage) =>
  Fleet.Service("Server", spec(environment, release, storage));
