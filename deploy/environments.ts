import * as Option from "effect/Option";

/**
 * Studienbuch's environments, each an Alchemy stage of the stack: `pr-<n>` for a pull request's
 * preview, `beta` for every push to `main`, and `prod`. Everything about one follows from its stage.
 */
export interface Environment {
  readonly stage: string;
  /** `STUDIENBUCH_ENVIRONMENT`, which turns on dev-only features such as persona sign-in. */
  readonly kind: "preview" | "beta" | "production";
  /** The service's name on the host: the grant's name `studienbuch`, or that name and a suffix. */
  readonly service: string;
  readonly hostName: string;
  /** Previews stay on the Tailnet. */
  readonly visibility: "public" | "tailnet";
  /**
   * The R2 bucket, by its name in infra's tokens stack, which also keeps its S3 key in SOPS under
   * `projects/studienbuch/r2/<storage>/`. Previews share one bucket, each under its own prefix.
   */
  readonly storage: "previews" | "beta" | "prod";
  readonly blobPrefix: string;
  /** The service's memory limit. At most 3 previews run at a time. */
  readonly memory: string;
  /** Only a preview's database goes with it; the host dumps it first. */
  readonly dropDatabase: boolean;
}

const preview = (pr: number): Environment => ({
  stage: `pr-${pr}`,
  kind: "preview",
  service: `studienbuch-pr-${pr}`,
  hostName: `pr-${pr}.studienbuch.schnau.dev`,
  visibility: "tailnet",
  storage: "previews",
  blobPrefix: `pr-${pr}/`,
  memory: "512M",
  dropDatabase: true,
});

const beta: Environment = {
  stage: "beta",
  kind: "beta",
  service: "studienbuch-beta",
  hostName: "beta.studienbuch.app",
  visibility: "public",
  storage: "beta",
  blobPrefix: "",
  memory: "1G",
  dropDatabase: false,
};

const prod: Environment = {
  stage: "prod",
  kind: "production",
  service: "studienbuch",
  hostName: "studienbuch.app",
  visibility: "public",
  storage: "prod",
  blobPrefix: "",
  memory: "1G",
  dropDatabase: false,
};

/** The environment of a stage, or none for a stage that isn't one of Studienbuch's. */
export const of = (stage: string): Option.Option<Environment> => {
  if (stage === "beta") return Option.some(beta);
  if (stage === "prod") return Option.some(prod);
  // Calder names a pull request's stage `pr-<number>`, without leading zeros.
  const pr = /^pr-([1-9][0-9]*)$/.exec(stage)?.[1];
  return pr === undefined ? Option.none() : Option.some(preview(Number(pr)));
};

/** At most three previews run at a time (ADR 0007). */
const maxPreviews = 3;

/**
 * Why a new preview can't start beside the stages that have state, or none. A preview that runs
 * already always redeploys.
 */
export const noRoomFor = (
  preview: string,
  stages: ReadonlyArray<string>,
): Option.Option<string> => {
  const previews = stages.filter((stage) =>
    Option.exists(of(stage), (environment) => environment.kind === "preview"),
  );

  return previews.includes(preview) || previews.length < maxPreviews
    ? Option.none()
    : Option.some(
        `${previews.length} previews are running (${previews.join(", ")}); close a PR or wait`,
      );
};

export * as Environments from "./environments.ts";
