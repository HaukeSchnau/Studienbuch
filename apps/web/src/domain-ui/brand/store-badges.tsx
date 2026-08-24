import { cn } from "#/ui/cn.ts";

import { externalLinks } from "./links.ts";

/**
 * Apple and Google both require their supplied badge artwork, so these are images rather than
 * styled buttons. Both assets are trimmed to the button itself, so matching their heights is enough
 * to make them look like a pair.
 */
export const StoreBadges = ({ className }: { className?: string }) => (
  <div className={cn("flex flex-wrap items-center gap-3", className)}>
    <a
      className="rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:outline-none"
      href={externalLinks.appStore}
      rel="noreferrer"
      target="_blank"
    >
      <img
        alt="Laden im App Store"
        className="h-11 w-auto"
        height={40}
        src="/brand/app-store-badge.svg"
        width={120}
      />
    </a>
    <a
      className="rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:outline-none"
      href={externalLinks.playStore}
      rel="noreferrer"
      target="_blank"
    >
      <img
        alt="Jetzt bei Google Play"
        className="h-11 w-auto"
        height={192}
        src="/brand/google-play-badge.png"
        width={646}
      />
    </a>
  </div>
);
