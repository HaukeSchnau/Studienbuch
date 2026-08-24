import { cn } from "#/ui/cn.ts";

const markSizes = {
  sm: "size-8 rounded-[0.5rem]",
  md: "size-11 rounded-[0.65rem]",
  lg: "size-24 rounded-[1.4rem] sm:size-32 sm:rounded-[1.9rem] lg:size-40 lg:rounded-[2.35rem]",
} as const;

/**
 * The product mark: the app's green cover over a white page with the blue line trailing the curve.
 * It is a single SVG in `public/brand/mark.svg` so the favicon, the manifest icons and the page all
 * come from one file.
 */
export const Mark = ({
  className,
  size = "md",
}: {
  className?: string;
  size?: keyof typeof markSizes;
}) => (
  <img
    alt=""
    className={cn("shrink-0 shadow-card", markSizes[size], className)}
    height={64}
    src="/brand/mark.svg"
    width={64}
  />
);

/** Mark plus name. `tone` picks the text colour for the surface it sits on. */
export const Wordmark = ({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "on-primary";
}) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <Mark size="sm" />
    <span
      className={cn(
        "text-lg font-bold",
        tone === "on-primary" ? "text-white" : "text-primary-text",
      )}
    >
      Studienbuch
    </span>
  </span>
);
