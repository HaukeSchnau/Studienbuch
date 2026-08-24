import { createFileRoute } from "@tanstack/react-router";

import { Capabilities, ForSchools, GetTheApp, Hero, SubjectStrip } from "#/features/marketing";

export const Route = createFileRoute("/_public/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Studienbuch — Das digitale Studienbuch für die Schule" },
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
