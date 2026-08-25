import { createFileRoute } from "@tanstack/react-router";

import { siteUrl } from "#/domain-ui/brand/links.ts";
import { Capabilities, ForSchools, GetTheApp, Hero, SubjectStrip } from "#/features/marketing";

export const Route = createFileRoute("/_public/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Studienbuch — Das digitale Studienbuch für die Schule" },
      { property: "og:title", content: "Das digitale Studienbuch" },
      { property: "og:url", content: siteUrl },
      {
        property: "og:description",
        content:
          "Stundenplan, Vertretungen, Noten, Fehlzeiten und Hausaufgaben in einer App — auch ohne Empfang.",
      },
      {
        name: "description",
        content:
          "Stundenplan, Vertretungen, Noten, Fehlzeiten und Hausaufgaben in einer App — für Schülerinnen und Schüler, und für Schulen, die ihr Papier-Studienbuch ablösen wollen.",
      },
    ],
  }),
});

function LandingPage() {
  return (
    <>
      <Hero />
      <SubjectStrip />
      <Capabilities />
      <ForSchools />
      <GetTheApp />
    </>
  );
}
