// oxlint-disable-next-line studienbuch/no-dom-test-environment -- fixture: a per-file environment
// @vitest-environment jsdom
// oxlint-disable-next-line studienbuch/require-disposable-render -- fixture: a lifecycle hook in a browser test
import { afterEach, it } from "@effect/vitest";
// oxlint-disable-next-line studienbuch/no-dom-test-environment -- fixture: a DOM emulator
import { JSDOM } from "jsdom";
// oxlint-disable-next-line studienbuch/require-disposable-render -- fixture: React's act
import { act } from "react";
// oxlint-disable-next-line studienbuch/require-disposable-render -- fixture: a hand-made React root
import { createRoot } from "react-dom/client";
import { page } from "vitest/browser";

// oxlint-disable-next-line studienbuch/require-disposable-render -- fixture: a lifecycle hook in a browser test
afterEach(() => new JSDOM());

it("renders and clicks", async () => {
  createRoot(document.body).render(<p>Stand</p>);

  await act(async () => {
    // oxlint-disable-next-line studienbuch/require-disposable-render -- fixture: real input inside act
    await page.getByRole("button").click();
  });

  // oxlint-disable-next-line studienbuch/no-frame-waits-in-browser-tests -- fixture: waiting for a frame
  await new Promise(requestAnimationFrame);

  // A click on the element itself is synthetic, and fine to wait for.
  await page.getByRole("button").click();
});
