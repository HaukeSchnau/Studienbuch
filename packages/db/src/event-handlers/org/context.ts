import { ValidationError } from "@groundswell/core";
import { Effect } from "effect";

export const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

export const verifySystemInitiator = (initiatorId: string) =>
  initiatorId === SYSTEM_USER
    ? Effect.void
    : Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));

