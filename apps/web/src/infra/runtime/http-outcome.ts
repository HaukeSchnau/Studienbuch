export type HttpAvailabilityOutcome = "success" | "failure";

/** Client rejections are request failures, but they do not consume the server availability SLO. */
export function httpAvailabilityOutcome(response: Response): HttpAvailabilityOutcome {
  return response.status >= 500 ? "failure" : "success";
}
