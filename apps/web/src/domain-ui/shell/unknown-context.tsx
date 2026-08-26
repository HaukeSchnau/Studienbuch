import { Link } from "@tanstack/react-router";
import { Button } from "#/ui/button.tsx";

/**
 * What a link into a context this account does not hold arrives at.
 *
 * Deliberately incurious about which of the possible reasons applies. A student who was sent a
 * teacher's link, someone whose access was revoked, and someone who mistyped a school all want the
 * same thing from this screen, and enumerating the reasons would only tell a stranger which schools
 * exist.
 */
export const UnknownContext = () => (
  <main className="grid min-h-[60vh] place-items-center px-6 py-16">
    <div className="max-w-md text-center">
      <h1 className="text-3xl text-primary-text">Hier geht es nicht weiter</h1>
      <p className="mt-4 text-ink-soft">
        Dieser Bereich gehört nicht zu deinem Konto. Vielleicht war der Link für jemand anderen
        gedacht, oder du wolltest in einen anderen Bereich.
      </p>
      <Button asChild className="mt-7" radius="pill" size="lg" variant="brand">
        <Link to="/app">Zu meinem Studienbuch</Link>
      </Button>
    </div>
  </main>
);
