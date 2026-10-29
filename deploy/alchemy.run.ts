import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Fleet from "@schnau/fleet";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import * as State from "alchemy/State";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { Environments } from "./environments.ts";
import * as Platform from "./platform/fleet.ts";

/** What infra's tokens stack (`stacks/tokens.ts`) made for Studienbuch. */
interface Tokens {
  readonly studienbuch: {
    readonly s3Endpoint: string;
    readonly buckets: { readonly previews: string; readonly beta: string };
  };
}

/** infra's Domains stack (`stacks/domains.ts`), which holds the studienbuch.app zone. */
interface Domains {
  readonly studienbuchApp: { readonly zoneId: string };
}

// Alchemy reads the environment once it has imported this module.
process.env.FLEET_SERVICES_URL ??= Platform.controller;

/**
 * What Calder hands every deploy (`.calder/ci.ts`). The service reads them only once Alchemy plans
 * it, because `alchemy destroy` evaluates this stack too and Calder hands it no artifacts.
 */
const release: Platform.Release = {
  revision: Config.String("CALDER_REVISION"),
  bundle: Config.String("CALDER_BUNDLE"),
  node: Config.String("CALDER_NODE"),
};

/**
 * Stops a new preview while three others run. srv-2's grant caps Studienbuch's services as well,
 * but its refusal can't say which previews take the room. A destroyed stage leaves no state.
 */
const roomForPreview = Effect.fn(function* (stage: string) {
  // A stack can't require the state store, but the store is part of every stack's context.
  const store = yield* Effect.serviceOption(State.State);
  if (Option.isNone(store)) return;

  const stack = yield* Alchemy.Stack;
  // Every stage with resources, and none before the stack's first deploy.
  const stages = yield* (yield* store.value).listStages(stack.name).pipe(Effect.orDie);

  yield* Option.match(Environments.noRoomFor(stage, stages), {
    onNone: () => Effect.void,
    onSome: Effect.die,
  });
});

/**
 * A preview's secrets, generated once per stage and kept in Alchemy's state, which every holder of
 * the account's state-store token can read. That is fine for a Tailnet preview with demo data only;
 * beta and prod read theirs from srv-2's SOPS file.
 */
const previewSecrets = Effect.gen(function* () {
  const authSecret = yield* Alchemy.Random("AuthSecret");
  const demoKeySeed = yield* Alchemy.Random("DemoKeySeed");
  return { AUTH_SECRET: authSecret.text, DEMO_KEY_SEED: demoKeySeed.text };
});

/** The server of one environment, with its DNS record when it is public. */
const deploy = Effect.fn(function* (environment: Environments.Environment) {
  if (environment.storage === "prod") {
    // A second A record for studienbuch.app would send half of the legacy apps' traffic here.
    return yield* Effect.die("prod waits for the legacy apps to leave studienbuch.app (D10)");
  }
  if (environment.kind === "preview") yield* roomForPreview(environment.stage);

  const tokens = yield* Alchemy.stackRef<Tokens>("Tokens", { stage: "prod" });
  const storage = environment.storage;
  const server = yield* Platform.service(
    environment,
    release,
    {
      endpoint: Output.map(tokens, (tokens) => tokens.studienbuch.s3Endpoint),
      bucket: Output.map(tokens, (tokens) => tokens.studienbuch.buckets[storage]),
    },
    environment.kind === "preview" ? yield* previewSecrets : Platform.sopsSecrets(environment),
  );

  if (environment.visibility === "public") {
    const domains = yield* Alchemy.stackRef<Domains>("Domains", { stage: "prod" });
    yield* Cloudflare.DNS.Record("Address", {
      zoneId: Output.map(domains, (domains) => domains.studienbuchApp.zoneId),
      name: environment.hostName,
      type: "A",
      content: server.address.ipv4.pipe(
        Output.mapEffect((ipv4) =>
          ipv4 === undefined
            ? Effect.die("srv-2 reports no public IPv4 address")
            : Effect.succeed(ipv4),
        ),
      ),
      ttl: 300,
    }).pipe(
      // The old stack's beta record carries no owner, so the first deploy takes it over.
      Alchemy.AdoptPolicy.adopt(true),
    );
  }

  const url = `https://${environment.hostName}`;
  return { url, readiness: `${url}/api/health/ready` };
});

export default Alchemy.Stack(
  "Studienbuch",
  {
    providers: Layer.mergeAll(Fleet.providers(), Cloudflare.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    // `alchemy state` evaluates the stack at a placeholder stage to find its state store, and Calder
    // reads each deploy's outputs that way, so a stage that isn't Studienbuch's declares nothing.
    return yield* Option.match(Environments.of(stage), {
      onNone: () => Effect.succeed({}),
      onSome: deploy,
    });
  }),
);
