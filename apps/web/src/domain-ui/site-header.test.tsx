import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("#/infra/auth/client.ts", () => ({ authClient: auth }));

import { SiteHeader } from "./site-header.tsx";

describe("SiteHeader account link", () => {
  beforeEach(() => {
    auth.useSession.mockReset();
  });

  it("renders the compact signed-out link while an anonymous session check is pending", () => {
    auth.useSession.mockReturnValue({ data: null, isPending: true });

    const html = renderToStaticMarkup(<SiteHeader hasSessionCookie={false} />);

    expect(html).toContain('href="/anmelden"');
    expect(html).not.toContain("Mein Studienbuch");
  });

  it("renders the signed-in link immediately when the request carries a session cookie", () => {
    auth.useSession.mockReturnValue({ data: null, isPending: true });

    const html = renderToStaticMarkup(<SiteHeader hasSessionCookie />);

    expect(html).toContain('href="/app"');
    expect(html).toContain("Mein Studienbuch");
    expect(html).not.toContain("Anmelden");
  });

  it("lets the loaded session correct a stale cookie hint", () => {
    auth.useSession.mockReturnValue({ data: null, isPending: false });

    const html = renderToStaticMarkup(<SiteHeader hasSessionCookie />);

    expect(html).toContain('href="/anmelden"');
    expect(html).not.toContain("Mein Studienbuch");
  });
});
