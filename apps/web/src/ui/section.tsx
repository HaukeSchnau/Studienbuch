import type { ComponentProps, ReactNode } from "react";

import { cn } from "#/ui/cn.ts";

/** The page's single horizontal rhythm. Every band of content is measured against this. */
export const Container = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("mx-auto w-full max-w-6xl px-6 sm:px-8", className)} {...props} />
);

/** A vertical band of the page. `tone` picks the surface; spacing is deliberately uniform. */
export const Section = ({
  className,
  tone = "surface",
  ...props
}: ComponentProps<"section"> & { tone?: "surface" | "background" }) => (
  <section
    className={cn(
      "py-20 sm:py-28",
      tone === "background" ? "bg-background" : "bg-surface",
      className,
    )}
    {...props}
  />
);

/**
 * Section eyebrow, heading and lead paragraph. Green headings on white are the app's own
 * convention, so the default `tone` reproduces it; `on-primary` is for headings inside the band.
 */
export const SectionHeading = ({
  align = "start",
  eyebrow,
  lead,
  title,
  tone = "brand",
}: {
  align?: "start" | "center";
  eyebrow?: string;
  lead?: ReactNode;
  title: ReactNode;
  tone?: "brand" | "on-primary";
}) => (
  <div
    className={cn(
      "flex max-w-2xl flex-col gap-4",
      align === "center" && "mx-auto items-center text-center",
    )}
  >
    {eyebrow ? (
      <span
        className={cn(
          // `accent-sec`, not `accent`: the brand blue only reaches 4.0:1 on the light surfaces,
          // which fails AA at this size. The desaturated blue clears it at 4.5:1.
          "text-sm font-bold tracking-[0.14em] uppercase",
          tone === "on-primary" ? "text-white/70" : "text-accent-sec",
        )}
      >
        {eyebrow}
      </span>
    ) : null}
    <h2
      className={cn(
        "text-3xl text-balance sm:text-4xl",
        tone === "on-primary" ? "text-white" : "text-primary-text",
      )}
    >
      {title}
    </h2>
    {lead ? (
      <p
        className={cn("text-lg/relaxed", tone === "on-primary" ? "text-white/85" : "text-ink-soft")}
      >
        {lead}
      </p>
    ) : null}
  </div>
);

/** The app's white card: generous radius, soft blue-tinted shadow, no border. */
export const Card = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("rounded-card bg-surface p-7 shadow-card", className)} {...props} />
);
