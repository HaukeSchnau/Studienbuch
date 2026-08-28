import { Link } from "@tanstack/react-router";
import { Button } from "#/ui/button.tsx";

/**
 * What goes wrong inside the application, said from inside the application.
 *
 * The public site's error pages offer "Zurück zur Startseite", which is right for a visitor who
 * mistyped a marketing URL and wrong for someone signed in: it throws them out of the thing they
 * were using and onto an advertisement for it. These stay in the shell, so the navigation is still
 * there and the way on is back to their own Studienbuch.
 */
const AppErrorLayout = ({
  action,
  detail,
  heading,
}: {
  readonly action: React.ReactNode;
  readonly detail: string;
  readonly heading: string;
}) => (
  <main className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-5 py-10 sm:px-8">
    <div className="text-center">
      <h1 className="text-2xl text-primary-text sm:text-3xl">{heading}</h1>
      <p className="mt-3 text-ink-soft text-pretty">{detail}</p>
      <div className="mt-7">{action}</div>
    </div>
  </main>
);

export const AppNotFound = () => (
  <AppErrorLayout
    action={
      <Button asChild size="lg" variant="brand">
        <Link to="/app">Zu meinem Studienbuch</Link>
      </Button>
    }
    detail="Diese Seite gibt es hier nicht. Vielleicht hat sich der Link vertippt."
    heading="Nichts gefunden"
  />
);

/**
 * A link into a school this account has not redeemed a code for.
 *
 * Previously this redirected in silence: somebody sent a colleague a link to their own school, and
 * the colleague landed on their own overview with no idea that a different page had been asked for.
 * A redirect is only kind when the destination is the one that was wanted. Here it never is, so the
 * refusal is said out loud — together with the one thing that would fix it.
 */
export const ContextNotAvailable = () => (
  <AppErrorLayout
    action={
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" variant="brand">
          <Link to="/app">Zu meinem Studienbuch</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/aktivieren">Zugangscode einlösen</Link>
        </Button>
      </div>
    }
    detail="Zu diesem Bereich gehört kein Zugang auf deinem Konto. Wenn du einen Zugangscode für diese Schule hast, kannst du ihn jetzt einlösen."
    heading="Dieser Bereich gehört nicht zu dir"
  />
);

/** The operator area, seen by an account without a grant for it. */
export const OperatorOnly = () => (
  <AppErrorLayout
    action={
      <Button asChild size="lg" variant="brand">
        <Link to="/app">Zu meinem Studienbuch</Link>
      </Button>
    }
    detail="Dieser Bereich gehört der Verwaltung von Studienbuch und ist von deinem Konto aus nicht zu erreichen."
    heading="Nur für den Betrieb"
  />
);

/**
 * Shown when something inside the shell throws. Like the public one it prints nothing about the
 * error itself; the details go to the crash reporter, not to the screen.
 */
export const AppErrorState = ({ reset }: { readonly reset: () => void }) => (
  <AppErrorLayout
    action={
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset} size="lg" variant="brand">
          Nochmal versuchen
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/app">Zu meinem Studienbuch</Link>
        </Button>
      </div>
    }
    detail="Hier ist gerade etwas schiefgelaufen. Wir haben eine Meldung bekommen und sehen uns das an."
    heading="Das hat nicht geklappt"
  />
);
