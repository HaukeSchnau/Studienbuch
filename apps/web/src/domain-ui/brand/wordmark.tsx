import { cn } from "#/ui/cn.ts";

const iconSizes = {
  sm: "size-8 rounded-[0.5rem]",
  lg: "size-24 rounded-[1.4rem] sm:size-32 sm:rounded-[1.9rem] lg:size-40 lg:rounded-[2.35rem]",
} as const;

/**
 * The product icon, taken straight from the app: `apps/mobile/assets/images/icon.png`, the same
 * file Expo ships to the home screen. It is a square artwork, so the rounding is applied here.
 */
export const AppIcon = ({
  className,
  size = "sm",
}: {
  className?: string;
  size?: keyof typeof iconSizes;
}) => (
  <img
    alt=""
    className={cn("shrink-0 shadow-card", iconSizes[size], className)}
    height={512}
    src="/brand/icon-512.png"
    width={512}
  />
);

/** Icon plus name. `tone` picks the text colour for the surface it sits on. */
export const Wordmark = ({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "on-primary";
}) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <AppIcon />
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
