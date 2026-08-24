import { cn } from "#/ui/cn.ts";

/**
 * The app icon on its own. The source SVG carries the green field as a square, so the rounding has
 * to come from CSS — `branding/logo/app-icon.svg` is deliberately kept uncropped there so the same
 * file can feed the Expo icon pipeline, which wants the square.
 */
export const AppIcon = ({ className }: { className?: string }) => (
  <img
    alt=""
    className={cn("aspect-square overflow-hidden rounded-[22.37%]", className)}
    height={512}
    src="/brand/app-icon.svg"
    width={512}
  />
);

/**
 * Icon plus name, for the navigation and the footer. The heading-sized lockup in the hero is set by
 * each variant instead, because how big the icon gets to be next to the headline is exactly the
 * kind of decision the variants exist to differ on.
 */
export const Wordmark = ({ className }: { className?: string }) => (
  <span className={cn("flex items-center gap-2.5 font-bold", className)}>
    <AppIcon className="w-8 shadow-card" />
    Studienbuch
  </span>
);
