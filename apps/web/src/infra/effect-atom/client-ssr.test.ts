import { describe, expect, it } from "vite-plus/test";
import { Route as ClientRoute } from "../../routes/_client.tsx";
import { Route as PublicRoute } from "../../routes/_public.tsx";

describe("page rendering ownership", () => {
  it("disables SSR only for the client application branch", () => {
    expect(ClientRoute.options.ssr).toBe(false);
    expect(PublicRoute.options.ssr).toBeUndefined();
  });
});
