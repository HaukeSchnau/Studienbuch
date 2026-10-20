import * as Fleet from "@schnau/fleet";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/** studienbuch.app, which the Domains stack in ~/infra (stacks/domains.ts) holds. */
const zoneId = "e2c2685721c26e1b2103e3f0399085fd";
/** srv-2's public address, `lib/managed-hosts.nix` in ~/infra. */
const srv2 = "37.120.187.196";
const hostName = "beta.studienbuch.app";

/** srv-2 checks the placement against Studienbuch's grant in ~/infra. Calder delivers the revision itself. */
export default Alchemy.Stack(
  "Studienbuch",
  {
    providers: Layer.mergeAll(Fleet.providers(), Cloudflare.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    // The Domains stack declared this record until this stack took it over; adoption is only
    // needed for that first deploy.
    yield* Cloudflare.DNS.Record("Beta", {
      zoneId,
      name: hostName,
      type: "A",
      content: srv2,
      ttl: 1800,
    }).pipe(Alchemy.AdoptPolicy.adopt(true));
    const placement = yield* Fleet.Placement("Release", {
      project: "studienbuch",
      host: "srv-2",
      endpoint: { hostName, visibility: "public" },
      secrets: {
        betterAuthSecret: "projects/studienbuch/better-auth-secret",
        smtpUrl: "projects/studienbuch/smtp-url",
        webUntisUsername: "projects/studienbuch/webuntis-username",
        webUntisPassword: "projects/studienbuch/webuntis-password",
      },
      parameters: {
        webUntisSchoolName: "IGS Lilienthal",
        webUntisSchoolLoginName: "igs-lilienthal",
        webUntisServerUrl: "https://igs-lilienthal.webuntis.com",
        webUntisTenantId: "6603700",
      },
    });
    return { url: placement.url };
  }),
);
