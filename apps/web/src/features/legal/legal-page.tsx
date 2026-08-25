import type { ReactNode } from "react";

import { Container, Section } from "#/ui/section.tsx";

import { legalLastUpdated } from "./entity.ts";

/**
 * Layout for the legal pages: a single narrow column of prose.
 *
 * These address parents, school administrators and, if it ever comes to it, a supervisory
 * authority, so they use "Sie" rather than the "du" the rest of the site is written in.
 */
export const LegalPage = ({ children, title }: { children: ReactNode; title: string }) => (
  <Section>
    <Container className="max-w-3xl">
      <h1 className="text-4xl/snug text-primary-text sm:text-5xl/snug">{title}</h1>
      <p className="mt-4 text-sm text-ink-soft">Stand: {legalLastUpdated}</p>

      <div className="prose prose-lg mt-12 max-w-none prose-headings:font-bold prose-headings:text-primary-text prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-2xl prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-xl prose-p:text-ink-soft prose-a:font-semibold prose-a:text-accent-sec prose-strong:text-ink prose-li:text-ink-soft prose-code:font-medium prose-code:text-ink prose-code:before:content-none prose-code:after:content-none">
        {children}
      </div>
    </Container>
  </Section>
);

/** A labelled block of contact or register details, set as an address rather than a paragraph. */
export const DetailBlock = ({ children, label }: { children: ReactNode; label: string }) => (
  <>
    <h3>{label}</h3>
    <address className="not-italic text-ink-soft">{children}</address>
  </>
);
