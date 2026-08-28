import { Link } from "@tanstack/react-router";

import { Button } from "#/ui/button.tsx";
import { Container, Section } from "#/ui/section.tsx";

/**
 * The app draws an empty period in the week view as a grey card labelled "Freistunde". A missing
 * page is the same thing — a slot with nothing in it — so the 404 borrows the card rather than
 * apologising in the abstract.
 */
const FreePeriodCard = () => (
  <div aria-hidden className="w-full max-w-xs rounded-card bg-background p-6 text-left shadow-card">
    <p className="text-sm text-neutral">Freistunde</p>
    <div className="mt-4 flex flex-col gap-2">
      <div className="h-3 w-2/3 rounded-full bg-neutral-sec" />
      <div className="h-3 w-1/2 rounded-full bg-neutral-sec" />
    </div>
  </div>
);

const ErrorLayout = ({
  action,
  detail,
  heading,
  label,
}: {
  action: React.ReactNode;
  detail: string;
  heading: string;
  label: string;
}) => (
  <Section>
    <Container className="flex max-w-2xl flex-col items-center gap-8 text-center">
      <FreePeriodCard />
      <div className="flex flex-col gap-4">
        <p className="text-sm font-bold tracking-[0.14em] text-accent-sec uppercase">{label}</p>
        <h1 className="text-3xl/snug text-primary-text text-balance sm:text-4xl/snug">{heading}</h1>
        <p className="text-lg/relaxed text-ink-soft text-pretty">{detail}</p>
      </div>
      {action}
    </Container>
  </Section>
);

export const NotFound = () => (
  <ErrorLayout
    action={
      <Button asChild size="xl" variant="brand">
        <Link to="/">Zurück zur Startseite</Link>
      </Button>
    }
    detail="Diese Seite steht nicht auf dem Plan. Vielleicht hat sich der Link vertippt — oder die Seite ist umgezogen."
    heading="Freistunde"
    label="404"
  />
);

/**
 * Shown when a route throws. It deliberately does not print the error: this page is public, and a
 * stack trace or a database message is the last thing that should appear on it. The details go to
 * crash reporting instead.
 */
export const ErrorState = ({ reset }: { reset: () => void }) => (
  <ErrorLayout
    action={
      <Button onClick={reset} size="xl" variant="brand">
        Nochmal versuchen
      </Button>
    }
    detail="Hier ist gerade etwas schiefgelaufen. Wir haben eine Meldung bekommen und sehen uns das an."
    heading="Das hat nicht geklappt"
    label="Fehler"
  />
);
