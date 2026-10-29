/**
 * The sync engine's HTTP routes: the ticket route, which checks the bearer session once, and the
 * WebSocket at `Connection.socketPath`, which spends a ticket and serves the connection.
 */
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { Connection } from "../protocol/Connection.ts";
import { Connections } from "./Connections.ts";
import { Ports } from "./Ports.ts";
import { Tickets } from "./Tickets.ts";

export * as Routes from "./Routes.ts";

const unauthorized = HttpServerResponse.empty({ status: 401 });

const ticketJson = HttpServerResponse.schemaJson(Connection.Ticket);

export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const resolver = yield* Ports.SessionResolver;
    const tickets = yield* Tickets.Service;
    const connections = yield* Connections.Service;

    const ticket = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const session = yield* resolver.resolve(request.headers);

      if (Option.isNone(session)) return unauthorized;

      return yield* Effect.orDie(ticketJson({ ticket: yield* tickets.issue(session.value) }));
    });

    const socket = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;

      const ticket = Option.flatMapNullishOr(HttpServerRequest.toURL(request), (url) =>
        url.searchParams.get("ticket"),
      );

      const session = Option.isNone(ticket) ? Option.none() : yield* tickets.redeem(ticket.value);

      if (Option.isNone(session)) return unauthorized;
      const upgraded = yield* Effect.orDie(request.upgrade);
      yield* connections.serve(session.value, upgraded);

      return HttpServerResponse.empty();
    });

    return Layer.mergeAll(
      HttpRouter.add("POST", Connection.ticketPath, ticket),
      HttpRouter.add("GET", Connection.socketPath, socket),
    );
  }),
);
