import { describe, it, vi } from "@effect/vitest";

// oxlint-disable-next-line studienbuch/no-test-timeout-or-unreasoned-skip -- fixture: a raised project timeout
vi.setConfig({ testTimeout: 60_000 });

describe("registrations", () => {
  // oxlint-disable-next-line studienbuch/no-test-timeout-or-unreasoned-skip -- fixture: a per-test timeout
  it("takes long", () => undefined, 10_000);

  // oxlint-disable-next-line studienbuch/no-test-timeout-or-unreasoned-skip -- fixture: a retry
  it("flakes", { retry: 3 }, () => undefined);

  // oxlint-disable-next-line studienbuch/no-test-timeout-or-unreasoned-skip -- fixture: a skip without a reason
  it.skip("is broken", () => undefined);

  // quarantine: the import corpus has no school with block periods yet.
  it.skip("handles block periods", () => undefined);
});
