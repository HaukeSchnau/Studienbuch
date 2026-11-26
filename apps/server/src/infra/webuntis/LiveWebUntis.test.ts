import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { describe, expect, it, layer } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import { LiveWebUntis } from "./LiveWebUntis.ts";

/** Every request the server received, as `<method> <path>`. */
class Received extends Context.Service<Received, Ref.Ref<ReadonlyArray<string>>>()(
  "LiveWebUntisTest.Received",
) {}

/** A server that counts what reaches it, and answers each path with its status. */
const server = Layer.unwrap(
  Effect.map(Ref.make<ReadonlyArray<string>>([]), (received) => {
    const answer = (path: `/${string}`, status: number) =>
      HttpRouter.add("*", path, (request) =>
        Ref.update(received, (all) => [...all, `${request.method} ${path}`]).pipe(
          Effect.as(
            HttpServerResponse.empty({
              status,
              headers: status === 302 ? { location: "/elsewhere" } : {},
            }),
          ),
        ),
      );

    return HttpRouter.serve(
      Layer.mergeAll(
        answer("/misdirected", 421),
        answer("/moved", 302),
        answer("/unauthorized", 401),
        answer("/WebUntis/j_spring_security_check", 302),
        answer("/elsewhere", 200),
      ),
      { disableLogger: true, disableListenLog: true },
    ).pipe(Layer.merge(Layer.succeed(Received)(received)));
  }),
).pipe(Layer.provideMerge(NodeHttpServer.layerTest));

const request = (method: "GET" | "POST", path: string) =>
  HttpServer.addressFormattedWith((origin) =>
    Effect.succeed(
      method === "GET"
        ? HttpClientRequest.get(`${origin}${path}`)
        : HttpClientRequest.post(`${origin}${path}`).pipe(
            HttpClientRequest.bodyUrlParams({ j_username: "konto-a", j_password: "erfunden" }),
          ),
    ),
  );

/** A gate that admits everything and counts what it admitted and how often it lost. */
const counting = Effect.gen(function* () {
  const admitted = yield* Ref.make(0);
  const lost = yield* Ref.make(0);

  return {
    gate: { admit: Ref.update(admitted, (n) => n + 1), lose: Ref.update(lost, (n) => n + 1) },
    admitted: Ref.get(admitted),
    lost: Ref.get(lost),
  };
});

layer(server)("LiveWebUntis", (it) => {
  it.effect(
    "sends each admitted request once, a form included, when WebUntis answers 421 or 302",
    () =>
      Effect.gen(function* () {
        const received = yield* Received;

        const cases = [
          ["GET", "/misdirected"],
          ["POST", "/misdirected"],
          ["GET", "/moved"],
          ["POST", "/moved"],
        ] as const;

        const results = yield* Effect.forEach(cases, ([method, path]) =>
          Effect.gen(function* () {
            yield* Ref.set(received, []);
            const { gate, admitted } = yield* counting;
            const client = yield* LiveWebUntis.gated(yield* HttpClient.HttpClient, gate);
            const response = yield* client.execute(yield* request(method, path));

            return {
              sent: `${method} ${path}`,
              status: response.status,
              admitted: yield* admitted,
              received: (yield* Ref.get(received)).length,
            };
          }).pipe(Effect.provide(LiveWebUntis.transport)),
        );

        expect(results).toEqual([
          { sent: "GET /misdirected", status: 421, admitted: 1, received: 1 },
          { sent: "POST /misdirected", status: 421, admitted: 1, received: 1 },
          { sent: "GET /moved", status: 302, admitted: 1, received: 1 },
          { sent: "POST /moved", status: 302, admitted: 1, received: 1 },
        ]);
      }),
  );

  it.effect("loses the session on a 401, and never sends a second login form", () =>
    Effect.gen(function* () {
      const received = yield* Received;
      yield* Ref.set(received, []);
      const { gate, admitted, lost } = yield* counting;
      const client = yield* LiveWebUntis.gated(yield* HttpClient.HttpClient, gate);
      const login = yield* request("POST", "/WebUntis/j_spring_security_check");

      yield* client.execute(login);
      const again = yield* Effect.flip(client.execute(login));
      const afterLogin = yield* lost;
      const unauthorized = yield* client.execute(yield* request("GET", "/unauthorized"));

      expect({
        again: again.reason._tag,
        afterLogin,
        unauthorized: unauthorized.status,
        lost: yield* lost,
        admitted: yield* admitted,
        received: yield* Ref.get(received),
      }).toEqual({
        again: "TransportError",
        afterLogin: 1,
        unauthorized: 401,
        lost: 2,
        admitted: 2,
        received: ["POST /WebUntis/j_spring_security_check", "GET /unauthorized"],
      });
    }).pipe(Effect.provide(LiveWebUntis.transport)),
  );
});

describe("LiveWebUntis.credentials", () => {
  const read = (env: Record<string, string>) =>
    LiveWebUntis.credentials.pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env })),
    );

  const school = {
    WEBUNTIS_SCHOOL_LOGIN_NAME: "erfundene-schule",
    WEBUNTIS_SERVER_URL: "https://erfunden.example",
    WEBUNTIS_USERNAME: "konto-a",
  };

  it.effect("is none without settings, and an error naming what is missing when partial", () =>
    Effect.gen(function* () {
      const none = yield* read({});
      const partial = yield* Effect.flip(read(school));
      const all = yield* read({ ...school, WEBUNTIS_PASSWORD: "erfunden" });

      expect({
        none: Option.isNone(none),
        partial: partial.message,
        all: Option.map(all, ({ school, credential }) => ({
          school,
          username: credential.username,
          password: Redacted.value(credential.password),
        })),
      }).toEqual({
        none: true,
        partial: expect.stringContaining("WEBUNTIS_PASSWORD missing"),
        all: Option.some({
          school: {
            loginName: "erfundene-schule",
            serverUrl: "https://erfunden.example",
            tenantId: undefined,
          },
          username: "konto-a",
          password: "erfunden",
        }),
      });
    }),
  );
});
