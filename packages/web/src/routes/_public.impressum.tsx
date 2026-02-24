import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/impressum")({
  beforeLoad: () => {
    throw redirect({ href: "https://haukeschnau.de/impressum" });
  },
  component: () => null,
});
