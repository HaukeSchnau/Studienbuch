import type { ReactNode } from "react";

import { SiteFooter } from "#/domain-ui/SiteFooter.tsx";
import { SiteHeader } from "#/domain-ui/SiteHeader.tsx";
import { Blob } from "#/ui/Blob.tsx";

import { Operator } from "./Operator.ts";

/**
 * The frame of the Impressum and the Datenschutzerklärung: one narrow column of prose. They address
 * parents, school administrators and, if it comes to it, a supervisory authority, so they say "Sie"
 * where the landing page says "du" to students.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="public-page legal">
      <SiteHeader />
      <main className="legal-main">
        <Blob className="legal-blob" duration={30} rotate={24} outline="kidney" tone="green" />
        <div className="container legal-column">
          <h1>{title}</h1>
          <p className="legal-updated">Stand: {Operator.lastUpdated}</p>
          <div className="legal-prose">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** A labelled block of contact or register details, set as an address. */
export function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <h3>{label}</h3>
      <address>{children}</address>
    </>
  );
}
