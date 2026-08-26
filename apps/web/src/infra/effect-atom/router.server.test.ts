import { describe, expect, it } from "vite-plus/test";
import { getRouter } from "../../router.tsx";

describe("Router atom ownership", () => {
  it("creates one isolated registry for every router instance", () => {
    const first = getRouter().options.context.atomRegistry;
    const second = getRouter().options.context.atomRegistry;

    expect(first).not.toBe(second);
    first.dispose();
    second.dispose();
  });
});
