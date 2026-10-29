import { Api } from "@stu/api";
import { Mail as ApiMail } from "@stu/api/Mail";
import { System } from "@stu/api/System";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as RpcServer from "effect/rpc/RpcServer";
import { Shortcuts } from "../dev/Shortcuts.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { Mail } from "../infra/mail/Mail.ts";

const handlers = System.Rpcs.merge(ApiMail.Rpcs).toLayer(
  Effect.gen(function* () {
    const { revision, environment } = yield* Deployment.Current;

    return {
      "System.info": () =>
        Effect.map(
          DateTime.now,
          (serverTime) => new System.Info({ revision, environment, serverTime }),
        ),
      "Mail.captured": () => Mail.captured,
    };
  }),
);

/** Effect RPC over HTTP POST at `Api.path`. */
export const layer = RpcServer.layerHttp({
  group: Api.Rpcs,
  path: Api.path,
  protocol: "http",
}).pipe(Layer.provide([handlers, Shortcuts.handlers, Api.serialization]));

export * as Rpc from "./Rpc.ts";
