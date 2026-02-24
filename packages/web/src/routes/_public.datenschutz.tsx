import { createFileRoute } from "@tanstack/react-router";

import DatenschutzPage from "~/legacy-next-app/app/(public)/datenschutz/page";

export const Route = createFileRoute("/_public/datenschutz")({
  component: DatenschutzPage,
});
