import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "#/domain-ui/SiteFooter.tsx";
import { SiteHeader } from "#/domain-ui/SiteHeader.tsx";
import { Features } from "#/features/marketing/Features.tsx";
import { ForSchools } from "#/features/marketing/ForSchools.tsx";
import { GetTheApp } from "#/features/marketing/GetTheApp.tsx";
import { Hero } from "#/features/marketing/Hero.tsx";
import landingCss from "#/features/marketing/landing.css?url";
import { PaperContrast } from "#/features/marketing/PaperContrast.tsx";
import { Privacy } from "#/features/marketing/Privacy.tsx";
import { SubjectStrip } from "#/features/marketing/SubjectStrip.tsx";

const description =
  "Stundenplan, Vertretungen, Noten, Fehlzeiten und Hausaufgaben in einer App, auch ohne Empfang und Ende-zu-Ende-verschlüsselt. Für Schülerinnen und Schüler, und für Schulen, die ihr Papier-Studienbuch ablösen wollen.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studienbuch: das digitale Studienbuch für die Schule" },
      { name: "description", content: description },
      { property: "og:title", content: "Das digitale Studienbuch" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: landingCss }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="public-page landing">
      <SiteHeader />
      <main>
        <Hero />
        <SubjectStrip />
        <PaperContrast />
        <Features />
        <Privacy />
        <ForSchools />
        <GetTheApp />
      </main>
      <SiteFooter />
    </div>
  );
}
