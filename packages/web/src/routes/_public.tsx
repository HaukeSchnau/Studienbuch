import { Outlet, createFileRoute } from "@tanstack/react-router";

import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/header/Header";

export const Route = createFileRoute("/_public")({
  component: PublicRouteLayout,
});

function PublicRouteLayout() {
  return (
    <div className="relative flex min-h-screen flex-col pb-16 pt-4">
      <Header />
      <main className="grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
