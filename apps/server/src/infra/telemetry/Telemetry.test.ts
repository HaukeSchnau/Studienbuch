import { describe, expect, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Schema from "effect/Schema";
import { Telemetry } from "./Telemetry.ts";

/** A failure whose message quotes a value, as a library's can. */
class QueryFailed extends Schema.TaggedError<QueryFailed, { readonly brand: unique symbol }>()(
  "Test.QueryFailed",
  {
    address: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message() {
    return `Query failed for ${this.address}`;
  }
}

describe("Telemetry.withoutText", () => {
  it("keeps a failure's tag, code, constraint and frames, and drops its messages and fields", () => {
    const address = "quendolin.amselreuter@example.test";

    // Postgres's error for a unique key names the row's value in its detail.
    const postgres = Object.assign(
      new Error('duplicate key value violates unique constraint "auth_user_email_key"'),
      { code: "23505", constraint: "auth_user_email_key", detail: `Key (email)=(${address})` },
    );

    const shown = Cause.pretty(
      Telemetry.withoutText(Cause.fail(new QueryFailed({ address, cause: postgres }))),
    );

    expect({
      head: shown.split("\n")[0],
      cause: shown.includes("[cause]: Error: 23505 auth_user_email_key"),
      frames: shown.includes("Telemetry.test.ts"),
      address: shown.includes(address),
      message: shown.includes("duplicate key"),
    }).toEqual({
      head: "Test.QueryFailed: ",
      cause: true,
      frames: true,
      address: false,
      message: false,
    });
  });
});
