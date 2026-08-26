import { MarketingApi } from "@stu/api";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { RpcClient } from "effect/unstable/rpc";
import { browserRpcProtocol } from "#/infra/rpc/protocol.ts";

const makeClient = RpcClient.make(MarketingApi.Rpcs);

export const submitEnquiry = (form: FormData, startedAt: number): Promise<boolean> =>
  Effect.scoped(
    Schema.decodeUnknownEffect(MarketingApi.EnquirySubmission)({
      schoolName: form.get("schoolName"),
      contactName: form.get("contactName"),
      email: form.get("email"),
      message: form.get("message"),
      trap: form.get("trap") ?? undefined,
      startedAt,
    }).pipe(
      Effect.flatMap((submission) =>
        makeClient.pipe(
          Effect.flatMap((client) => client["Marketing.SubmitEnquiry"](submission)),
          Effect.provide(browserRpcProtocol),
        ),
      ),
      Effect.result,
      Effect.map(Result.isSuccess),
    ),
  ).pipe(Effect.runPromise);
