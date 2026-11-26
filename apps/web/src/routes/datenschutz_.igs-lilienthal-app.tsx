import { createFileRoute } from "@tanstack/react-router";

import { IgsLilienthalDatenschutz } from "#/features/legal/IgsLilienthalDatenschutz.tsx";
import legalCss from "#/features/legal/legal.css?url";

// The trailing underscore keeps this page out of `/datenschutz`'s layout: the two notices are
// separate pages that share only a path prefix.
export const Route = createFileRoute("/datenschutz_/igs-lilienthal-app")({
  head: () => ({
    meta: [{ title: "Datenschutzerklärung IGS Lilienthal · Studienbuch" }],
    links: [{ rel: "stylesheet", href: legalCss }],
  }),
  component: IgsLilienthalDatenschutz,
});
