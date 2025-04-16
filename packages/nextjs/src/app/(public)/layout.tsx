import clsx from "clsx";
import type { ReactNode } from "react";

import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/header/Header";
import styles from "./layout.module.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div
      className={clsx(
        "relative flex min-h-screen flex-col pb-16 pt-4",
        styles.wrapper,
      )}
    >
      <Header />
      <main className="grow">{children}</main>
      <Footer />
    </div>
  );
}
