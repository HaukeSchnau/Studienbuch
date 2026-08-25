import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import { describe, expect, it } from "vite-plus/test";
import { EnquiryNotifier } from "./enquiry-notifier.ts";

describe("EnquiryNotifier", () => {
  it("keeps contact details out of operational telemetry", async () => {
    const output: Array<string> = [];
    const logger = Logger.make((options) => {
      output.push(Logger.formatJson.log(options));
    });

    await Effect.gen(function* () {
      const notifier = yield* EnquiryNotifier;
      yield* notifier.announce({
        id: "enquiry-safe-id",
        schoolName: "PII school sentinel",
        contactName: "PII contact sentinel",
        email: "pii-sentinel@example.invalid",
      });
    }).pipe(
      Effect.provide(EnquiryNotifier.layer),
      Effect.provide(Logger.layer([logger])),
      Effect.runPromise,
    );

    expect(output).toHaveLength(1);
    expect(output[0]).toContain("enquiry-safe-id");
    expect(output[0]).not.toContain("PII school sentinel");
    expect(output[0]).not.toContain("PII contact sentinel");
    expect(output[0]).not.toContain("pii-sentinel@example.invalid");
  });
});
