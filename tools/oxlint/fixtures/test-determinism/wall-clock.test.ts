import { it, vi } from "@effect/vitest";

it("measures elapsed time", () => {
  // oxlint-disable-next-line studienbuch/no-wall-clock-in-tests -- fixture: Date.now in a test
  const started = Date.now();
  // oxlint-disable-next-line studienbuch/no-wall-clock-in-tests -- fixture: performance.now in a test
  const elapsed = performance.now() - started;
  // oxlint-disable-next-line studienbuch/no-wall-clock-in-tests -- fixture: new Date() in a test
  const today = new Date();

  // A reading that seeds a mock, and a fixed date, pass.
  vi.spyOn(Date, "now").mockReturnValue(Date.now());

  return [elapsed, today, new Date(0)];
});
