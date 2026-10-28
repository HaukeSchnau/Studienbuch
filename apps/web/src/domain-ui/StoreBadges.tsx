import { Site } from "./Site.ts";

/**
 * Apple and Google require their own badge artwork, so these are images rather than buttons. Both
 * are trimmed to the button, so equal heights make them a pair. The browser link sits beside them
 * as the third way in.
 */
export function StoreBadges({ tone }: { tone: "canvas" | "hero" }) {
  return (
    <div className={`store-badges store-badges-${tone}`}>
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
      <a className="browser-badge press" href={Site.webApp}>
        Im Browser öffnen
      </a>
    </div>
  );
}
