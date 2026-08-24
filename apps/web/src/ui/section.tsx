import type { ComponentProps, ReactNode } from "react";

import { cn } from "#/ui/cn.ts";

const containerWidths = {
  default: "max-w-6xl",
  // The legacy site used percentage margins and no maximum, which is where its generous, airy
  // feeling came from. `wide` is the closest bounded equivalent, for the hero.
  wide: "max-w-7xl",
} as const;

/** The page's single horizontal rhythm. Every band of content is measured against this. */
export const Container = ({
  className,
  width = "default",
  ...props
}: ComponentProps<"div"> & { width?: keyof typeof containerWidths }) => (
  <div
    className={cn("mx-auto w-full px-6 sm:px-10", containerWidths[width], className)}
    {...props}
  />
);

/** A vertical band of the page. `tone` picks the surface; spacing is deliberately uniform. */
export const Section = ({
  className,
  tone = "surface",
  ...props
}: ComponentProps<"section"> & { tone?: "surface" | "background" }) => (
  <section
    className={cn(
      "py-20 sm:py-24",
      tone === "background" ? "bg-background" : "bg-surface",
      className,
    )}
    {...props}
  />
);

/** Section heading and lead. Green headings on white are the app's and the legacy site's own convention. */
export const SectionHeading = ({ lead, title }: { lead?: ReactNode; title: ReactNode }) => (
  <div className="flex max-w-2xl flex-col gap-5">
    <h2 className="text-3xl/snug text-primary-text text-balance sm:text-4xl/snug">{title}</h2>
    {lead ? <p className="text-xl/relaxed text-ink-soft text-pretty">{lead}</p> : null}
  </div>
);

/** The app's white card: generous radius, soft blue-tinted shadow, no border. */
export const Card = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("rounded-card-lg bg-surface p-8 shadow-card", className)} {...props} />
);
