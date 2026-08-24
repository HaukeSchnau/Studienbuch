import { storeLinks } from "#/domain-ui/brand/links.ts";
import { cn } from "#/ui/cn.ts";

/**
 * The two official store badges. Both vendors ship them at a fixed aspect ratio and forbid
 * redrawing them, so the row sizes by height and lets each badge keep its own width.
 */
export const StoreBadges = ({ className }: { className?: string }) => (
  <div className={cn("flex h-11 items-center gap-4 sm:h-14", className)}>
    <a
      className="h-full transition-transform hover:scale-105 focus-visible:scale-105"
      href={storeLinks.android}
      rel="noreferrer"
      target="_blank"
    >
      <img alt="Jetzt bei Google Play" className="h-full" src="/brand/google-play-badge.png" />
    </a>
    <a
      className="h-full transition-transform hover:scale-105 focus-visible:scale-105"
      href={storeLinks.ios}
      rel="noreferrer"
      target="_blank"
    >
      <img alt="Laden im App Store" className="h-full" src="/brand/app-store-badge.svg" />
    </a>
  </div>
);
