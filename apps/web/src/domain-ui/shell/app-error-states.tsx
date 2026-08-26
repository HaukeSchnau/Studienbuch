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
      <Button asChild radius="pill" size="lg" variant="brand">
        <Link to="/app">Zu meinem Studienbuch</Link>
      </Button>
    }
    detail="Diese Seite gibt es hier nicht. Vielleicht hat sich der Link vertippt."
    heading="Nichts gefunden"
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
        <Button onClick={reset} radius="pill" size="lg" variant="brand">
          Nochmal versuchen
        </Button>
        <Button asChild radius="pill" size="lg" variant="outline">
          <Link to="/app">Zu meinem Studienbuch</Link>
        </Button>
      </div>
    }
    detail="Hier ist gerade etwas schiefgelaufen. Wir haben eine Meldung bekommen und sehen uns das an."
    heading="Das hat nicht geklappt"
  />
);
