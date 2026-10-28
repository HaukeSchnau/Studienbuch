import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Fleet from "@schnau/fleet";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
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

/**
 * What Calder hands every deploy (`.calder/ci.ts`). The service reads them only once Alchemy plans
 * it, because `alchemy destroy` evaluates this stack too and Calder hands it no artifacts.
 */
const release: Platform.Release = {
  revision: Config.String("CALDER_REVISION"),
  bundle: Config.String("CALDER_BUNDLE"),
  node: Config.String("CALDER_NODE"),
};

/** The server of one environment, with its DNS record when it is public. */
const deploy = Effect.fn(function* (environment: Environments.Environment) {
  if (environment.storage === "prod") {
    // A second A record for studienbuch.app would send half of the legacy apps' traffic here.
    return yield* Effect.die("prod waits for the legacy apps to leave studienbuch.app (D10)");
  }

  const tokens = yield* Alchemy.stackRef<Tokens>("Tokens", { stage: "prod" });
  const storage = environment.storage;
  const server = yield* Platform.service(environment, release, {
    endpoint: Output.map(tokens, (tokens) => tokens.studienbuch.s3Endpoint),
    bucket: Output.map(tokens, (tokens) => tokens.studienbuch.buckets[storage]),
  });

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
