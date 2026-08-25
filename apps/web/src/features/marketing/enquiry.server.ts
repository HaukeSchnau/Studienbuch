import { EnquiryStore } from "@stu/server";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { exitFailureResponse, jsonResponse, readJsonBody } from "#/infra/http/response.server.ts";
import { runRouteEffect } from "#/infra/runtime/request.server.ts";

export const enquiryRoute = "/api/enquiry";

/**
 * The shortest time a person plausibly needs to fill in four fields. Scripts post instantly.
 *
 * A client-supplied timestamp is trivially forged, so this is not a security control — it is a
 * filter for unsophisticated bots, and it costs an honest visitor nothing.
 */
const minimumFillMillis = 3_000;

/**
 * Accepts a school's enquiry.
 *
 * The body is parsed into `EnquirySubmission` in one step at the boundary; nothing downstream
 * inspects raw fields. Parsing and the spam checks happen before the runtime is touched, so a
 * malformed post or a bot never causes a database connection to be opened.
 *
 * Spam is handled with a honeypot and a fill-time check rather than a captcha: a captcha means a
 * third-party script, a consent problem and an accessibility tax, which is a great deal to impose
 * on the handful of people a month this form is for.
 *
 * A caught bot receives the same `202` as a person. Telling it that it failed is how it learns to
 * try again differently.
 */
export function handleEnquiry(request: Request): Promise<Response> {
  return (async () => {
    const body = await readJsonBody(request);

    const decoded = EnquiryStore.decodeEnquirySubmission(body);
    if (Exit.isFailure(decoded)) {
      return jsonResponse({ error: "invalid_enquiry" }, 422);
    }
    const submission = decoded.value;

    const looksAutomated =
      (submission.trap ?? "").trim() !== "" ||
      Date.now() - submission.startedAt < minimumFillMillis;
    if (looksAutomated) {
      return jsonResponse({ status: "accepted" }, 202);
    }

    const exit = await runRouteEffect(
      EnquiryStore.record(submission).pipe(
        Effect.map(() => jsonResponse({ status: "accepted" }, 202)),
      ),
      { request, route: enquiryRoute },
    );

    return Exit.isSuccess(exit)
      ? exit.value
      : (exitFailureResponse(exit) ?? jsonResponse({ error: "internal_error" }, 500));
  })();
}
