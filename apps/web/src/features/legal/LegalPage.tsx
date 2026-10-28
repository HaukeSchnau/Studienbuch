import type { ReactNode } from "react";

import { SiteFooter } from "#/ui/SiteFooter.tsx";

/** The frame of the Impressum and the Datenschutzerklärung. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <main className="column content">
        <h1>{title}</h1>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
