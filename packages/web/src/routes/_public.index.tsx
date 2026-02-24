import { createFileRoute } from "@tanstack/react-router";

import HomePage from "~/legacy-next-app/app/(public)/page";

export const Route = createFileRoute("/_public/")({
  component: HomePage,
});
