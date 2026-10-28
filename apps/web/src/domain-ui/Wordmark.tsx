/**
 * The notebook app icon, from `branding/logo/app-icon.svg`, the same artwork the app ships to the
 * home screen. The artwork is square; the rounding happens here.
 */
export function AppIcon({ size }: { size: "small" | "large" }) {
  return (
    <img
      alt=""
      className={`app-icon app-icon-${size}`}
      height={1024}
      src="/brand/icon.svg"
      width={1024}
    />
  );
}

/** The icon and the name, linking home. */
export function Wordmark() {
  return (
    <a className="wordmark" href="/">
      <AppIcon size="small" />
      <span>Studienbuch</span>
    </a>
  );
}
