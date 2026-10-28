import { Underline } from "#/ui/Underline.tsx";

import { Site } from "./Site.ts";

/**
 * Apple and Google require their own badge artwork, so these are images rather than buttons. Both
 * are trimmed to the button, so equal heights make them a pair. The web app is the third way in,
 * a line of text below them rather than a third badge that would look like a counterfeit one.
 */
export function StoreBadges({ tone }: { tone: "canvas" | "hero" }) {
  return (
    <div className={`store-badges store-badges-${tone}`}>
      <div className="store-badge-row">
        <a className="store-badge press" href={Site.appStore} rel="noreferrer" target="_blank">
          <img alt="Laden im App Store" height={40} src="/brand/app-store-badge.svg" width={120} />
        </a>
        <a className="store-badge press" href={Site.playStore} rel="noreferrer" target="_blank">
          <img
            alt="Jetzt bei Google Play"
            height={192}
            src="/brand/google-play-badge.png"
            width={646}
          />
        </a>
      </div>
      <a className="browser-link" href={Site.webApp}>
        <span className="browser-link-text">
          oder direkt im Browser öffnen
          <Underline className="browser-link-underline" />
        </span>
        <svg aria-hidden className="browser-link-arrow" viewBox="0 0 24 24">
          <path d="M5 12h13M13 6l6 6-6 6" />
        </svg>
      </a>
    </div>
  );
}
