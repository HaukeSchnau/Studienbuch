import { describe, expect, it } from "vite-plus/test";
import { metricNames, observabilityContract } from "./contract.ts";

describe("external observability contract", () => {
  it("publishes the exact metric names used by the application", () => {
    expect(observabilityContract.metrics).toEqual(metricNames);
  });
});
