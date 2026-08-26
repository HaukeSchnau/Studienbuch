import { MarketingApi } from "@stu/api";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { record } from "./enquiry-store.ts";

const minimumFillMillis = 3_000;

export const MarketingRpcHandlers = MarketingApi.Rpcs.toLayer({
  "Marketing.SubmitEnquiry": (submission) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const looksAutomated =
        (submission.trap ?? "").trim() !== "" || now - submission.startedAt < minimumFillMillis;

      // Bots receive the same result as people. A rejection would teach them to alter the payload.
      if (!looksAutomated) yield* record(submission).pipe(Effect.orDie);
      return { status: "accepted" as const };
    }),
});
