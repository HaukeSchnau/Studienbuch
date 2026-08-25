/**
 * The legacy site's two colour blobs, redrawn.
 *
 * The original shipped them as four SVGs (`blob-blue.svg`, `blob-blue-md.svg` and the two green
 * ones) used as CSS `background` images and swapped at a media query, which pinned them to a fixed
 * pixel size at each breakpoint. These are the same paths as inline SVG, so they scale with the
 * viewport instead of stepping between two sizes.
 *
 * They are what gives the white page its character, and they belong behind everything: {@link
 * PageDecor} is positioned once by the public layout.
 */

/** Bleeds out of the top-right corner. */
const BlueBlob = () => (
  <svg
    aria-hidden
    className="drift absolute -top-24 right-0 h-[70vh] max-h-[900px] w-auto"
    fill="none"
    viewBox="0 0 580 1024"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M279.596 489.091C204.192 703.241 453.079 937.593 586.948 1028L617 -40.0997C438.736 -50.9957 68.9572 -45.5772 15.956 63.2647C-50.2955 199.317 105.43 273.528 196.269 239.956C287.109 206.385 373.85 221.404 279.596 489.091Z"
      fill="var(--color-accent-pale)"
    />
  </svg>
);

/** Bleeds out of the bottom-left corner of the first screen. */
const GreenBlob = () => (
  <svg
    aria-hidden
    className="drift absolute bottom-0 left-0 h-[45vh] max-h-[560px] w-auto"
    fill="none"
    viewBox="0 0 327 443"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M262.872 282.953C354.258 311.956 328.31 407.04 303.913 450.956L-21 527L-21 2.17035e-05C15.2535 9.43179 96.7897 42.9735 132.906 101.686C178.052 175.077 148.639 246.7 262.872 282.953Z"
      fill="var(--color-primary-pale)"
    />
  </svg>
);

/**
 * Both blobs, sized to the first screenful and clipped to it. They decorate the hero rather than
 * the whole document: stretched down a long page they would drift behind the content and read as
 * stray colour instead of framing.
 */
export const PageDecor = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-screen overflow-hidden opacity-50"
  >
    <BlueBlob />
    <GreenBlob />
  </div>
);
