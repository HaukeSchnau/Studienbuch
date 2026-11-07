import { Access } from "@stu/api/Access";
import * as AtomRpc from "effect/reactivity/AtomRpc";

import { ApiProtocol } from "../../infra/api/ApiProtocol.ts";

// The school's access code on "Willkommen": `Access.redeem` holds one use of it for the sign-up
// that follows, and names the school.

export * as AccessCode from "./AccessCode.ts";

class Client extends AtomRpc.Service<Client>()("AccessCode.Client", {
  group: Access.Rpcs,
  protocol: ApiProtocol.layer,
}) {}

/** Holds one use of the code for the sign-up, and names its school. */
export const redeem = Client.mutation("Access.redeem");

/** Why a code didn't open the way, in words the screen shows. */
export type Reason = "unavailable" | "rate-limited" | "offline";

// After the old web's sentences (legacy-2026-10 apps/web/src/features/auth/messages.ts).
export const sentence: Record<Reason, string> = {
  unavailable: "Dieser Zugangscode passt nicht. Er ist unbekannt, abgelaufen oder schon eingelöst.",
  "rate-limited":
    "Das waren zu viele Versuche hintereinander. Warte einen Moment und versuch es dann noch einmal.",
  offline: "Keine Verbindung zum Server. Für den Zugangscode brauchst du einmal Internet.",
};

/** The reason for a failed redemption. A server that couldn't be reached or read is `offline`. */
export const reasonOf = (error: { readonly _tag: string }): Reason =>
  error._tag === "Access.CodeUnavailable"
    ? "unavailable"
    : error._tag === "Access.RateLimited"
      ? "rate-limited"
      : "offline";

/** What "Konto erstellen" says under its title: "Demoschule am Wiesengrund, Schülerzugang". */
export const describe = (reservation: Pick<Access.Reservation, "schoolName" | "kind">) =>
  `${reservation.schoolName}, ${reservation.kind === "student" ? "Schülerzugang" : "Zugang"}`;
