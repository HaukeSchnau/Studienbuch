import { EyeOff, RefreshCw, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SwooshEdge } from "#/domain-ui/brand/swoosh.tsx";
import { Container, SectionHeading } from "#/ui/section.tsx";

const points: ReadonlyArray<{ body: string; icon: LucideIcon; title: string }> = [
  {
    icon: Zap,
    title: "Sofort da",
    body: "Die App öffnet sich mit deinen Daten, nicht mit einem Ladebalken — auch im Fachraum ohne Empfang.",
  },
  {
    icon: RefreshCw,
    title: "Nichts geht verloren",
    body: "Was du offline einträgst, bleibt erhalten und wird abgeglichen, sobald wieder Netz da ist.",
  },
  {
    icon: EyeOff,
    title: "Kein Tracking",
    body: "Keine Werbe- oder Analyse-SDKs und kein Verhaltensprofil. Fehlerberichte enthalten keine persönlichen Daten.",
  },
];

/**
 * The one thing the paper book and most school apps cannot do, so it gets the page's only dark
 * band. The blue rule underneath is the swoosh again, this time without its green.
 */
export const LocalFirst = () => (
  <section className="bg-ink pt-20 sm:pt-28">
    <Container className="flex flex-col gap-14">
      <SectionHeading
        align="center"
        eyebrow="Local-first"
        lead="Studienbuch speichert zuerst auf dem Gerät und gleicht ab, wenn wieder Verbindung da ist. Zwischen dir und deinem Stundenplan steht kein Netz."
        title="Funktioniert auch ohne Empfang"
        tone="on-primary"
      />

      <ul className="grid gap-10 sm:grid-cols-3">
        {points.map(({ body, icon: Icon, title }) => (
          <li className="flex flex-col gap-3" key={title}>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-accent-pale">
              <Icon aria-hidden className="size-5" strokeWidth={2.25} />
            </span>
            <h3 className="text-lg text-white">{title}</h3>
            <p className="text-white/70 text-pretty">{body}</p>
          </li>
        ))}
      </ul>
    </Container>

    {/* Closes the band by running off its bottom-left corner, the way the swoosh overshoots its
        green in the app. */}
    <SwooshEdge className="mt-20 h-10 opacity-80 sm:mt-28" variant="line" />
  </section>
);
