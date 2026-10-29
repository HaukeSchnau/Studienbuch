/**
 * How a device reaches `Protocol.Rpcs`. Right before each connect it posts its bearer token to the
 * ticket route and opens the WebSocket with the ticket in the URL, because a browser can't set
 * headers on an upgrade, and one tab may hold devices of several accounts.
 */
import * as Schema from "effect/Schema";

export * as Connection from "./Connection.ts";

/** `POST` with `Authorization: Bearer <session token>`. Without a valid session it answers 401. */
export const ticketPath = "/api/sync/ticket";

/** A ticket opens one connection, within 30 seconds of its issue. */
export const Ticket = Schema.Struct({ ticket: Schema.String });

/** The WebSocket, with the ticket in the query parameter `ticket`. An unknown ticket gets 401. */
export const socketPath = "/api/sync";

/** The socket's URL on a server origin, `wss:` for an `https:` origin. */
export const socketUrl = (origin: URL, ticket: string): URL => {
  const url = new URL(socketPath, origin);

  url.protocol = origin.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("ticket", ticket);

  return url;
};

/**
 * The codes the server closes a connection with, after the matching error when a call was in
 * flight. A device reconnects with backoff after any other close. Old clients rely on these
 * numbers, so they never change.
 */
export const CloseCode = {
  /**
   * The session was revoked or has ended. The device keeps its data and its outbox, stops
   * reconnecting and asks for sign-in.
   */
  sessionEnded: 4401,
  /**
   * Another device removed this one. The device connects once more and pulls, and wipes its data
   * and keys only when that pull answers `Sync.DeviceRevoked`, so a close alone never wipes it.
   */
  deviceRevoked: 4403,
  /** The client's contract is too old (`Sync.UpdateRequired`). The device waits for an update. */
  updateRequired: 4426,
} as const;
