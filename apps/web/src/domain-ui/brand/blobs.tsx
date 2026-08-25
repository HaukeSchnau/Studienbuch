import { cn } from "#/ui/cn.ts";

/**
 * The legacy site's colour blobs, plus a few drawn to match.
 *
 * The two legacy silhouettes are kept as they were. The rest are closed loops whose radius is a sum
 * of low-frequency harmonics — so it varies by more than two to one around the circle, giving real
 * lobes and waists, but barely changes between neighbouring samples, which is what keeps every turn
 * round. Sampling a handful of arbitrary radii instead puts a corner at each tight minimum.
 *
 * Every outline sits inside its own viewBox with room to spare, so none is cropped by the SVG
 * viewport. Position them so a good part hangs off the side of the page: the layout's
 * `overflow-x-clip` cuts that off, and nothing else is ever cut.
 */

const blobs = {
  /**
   * The legacy site's green blob, its outward sweep untouched. Only the return along the bottom,
   * which the original left as a straight line, is now a curve — continued from the reflection of
   * the preceding control point, so the tangent matches and the seam cannot kink.
   */
  legacyGreen: {
    viewBox: "-21 0 351 540",
    d: "M-21 0C15.2535 9.43179 96.7897 42.9735 132.906 101.686C178.052 175.077 148.639 246.7 262.872 282.953C354.258 311.956 328.31 407.04 303.913 450.956C279.5 494.9 140 552 -21 520Z",
  },
  /**
   * The legacy site's blue blob, unchanged. Its one straight edge already ran down the side of the
   * page, which is exactly where a straight edge is allowed to be.
   */
  legacyBlue: {
    viewBox: "-10 -55 640 1100",
    d: "M617 -40.1C438.74 -51 68.96 -45.58 15.96 63.26C-50.3 199.32 105.43 273.53 196.27 239.96C287.11 206.39 373.85 221.4 279.6 489.09C204.19 703.24 453.08 937.59 586.95 1028Z",
  },
  /**
   * A deep waist down one side, almost folded in half.
   */
  kidney: {
    viewBox: "0 0 680 680",
    d: "M310 44C350 39 369 38 410 46C452 54 476 59 510 84C544 110 559 130 575 169C592 208 590 232 589 273C588 314 582 332 570 368C558 405 552 420 532 450C511 481 500 492 472 516C445 540 433 547 399 567C365 588 352 602 310 617C268 631 239 645 196 636C152 627 121 611 100 573C78 534 81 495 91 449C101 403 131 382 148 351C166 320 174 323 176 299C177 274 159 266 155 233C151 200 143 173 157 140C170 106 186 90 218 70C250 50 270 49 310 44Z",
  },
  /**
   * Two lobes with a dip between them along the bottom.
   */
  twin: {
    viewBox: "0 0 680 680",
    d: "M355 98C395 80 427 67 467 78C507 90 528 116 550 153C572 190 565 219 575 258C585 297 588 305 601 342C613 378 636 396 636 434C636 473 632 504 603 528C573 552 536 553 495 551C454 550 434 525 405 520C376 516 381 517 355 530C330 544 320 572 282 586C245 601 214 611 173 602C133 593 111 575 84 542C57 508 50 483 44 440C38 397 41 371 58 332C74 294 93 277 125 252C156 226 177 228 208 210C240 192 245 188 275 165C306 142 316 116 355 98Z",
  },
  /**
   * Twin lobes again, pinched on the other side and rounder.
   */
  pinch: {
    viewBox: "0 0 680 680",
    d: "M304 52C344 64 361 80 389 106C417 132 422 150 440 178C457 207 455 217 473 243C490 268 501 271 525 301C549 332 575 348 590 391C605 434 612 468 596 510C581 551 555 571 515 593C476 615 448 610 405 617C361 625 347 627 304 630C261 634 238 647 196 636C155 625 127 614 103 579C80 544 82 510 84 468C86 425 107 407 113 374C120 341 119 340 113 307C108 274 88 257 87 215C85 174 85 142 107 107C130 71 155 55 196 44C236 33 264 39 304 52Z",
  },
  /** Mostly full, with one soft bite taken out of a flank. */
  notch: {
    viewBox: "0 0 680 680",
    d: "M307 90C340 107 343 127 371 142C399 156 405 151 441 159C478 166 510 157 550 179C590 200 619 220 636 261C653 302 645 333 632 377C618 420 597 435 571 472C545 509 536 524 505 555C473 586 458 610 417 622C376 634 346 633 307 615C268 597 252 568 228 535C204 503 208 483 190 458C172 434 165 435 142 415C118 394 98 389 78 360C58 330 48 311 44 273C40 235 44 214 59 176C74 139 86 118 117 94C149 69 172 59 212 58C251 57 274 73 307 90Z",
  },
} as const;

const tones = {
  green: "var(--color-primary-pale)",
  blue: "var(--color-accent-pale)",
} as const;

/**
 * One blob. The caller positions and sizes it, and is expected to pull it past the edge of the page
 * with a negative inset. Give it a box in the outline's own proportions; the shapes are not all
 * square, and `meet` will otherwise letterbox them.
 *
 * The host section needs `relative isolate`, so the negative layer stays inside it instead of
 * dropping behind the page background. Keep the blob within that section's height too: anything
 * that overhangs vertically is cut off square where the next section's background begins.
 */
export const EdgeBlob = ({
  blob,
  className,
  rotate = 0,
  tone,
}: {
  blob: keyof typeof blobs;
  className?: string;
  /** Degrees. Lets one outline be reused at another placement without reading as a repeat. */
  rotate?: number;
  tone: keyof typeof tones;
}) => {
  const { d, viewBox } = blobs[blob];

  return (
    // The drift animation owns the outer element's transform, so the rotation needs its own element
    // or the two overwrite each other.
    <div
      aria-hidden
      className={cn("drift pointer-events-none absolute -z-10 opacity-45", className)}
    >
      <div className="h-full w-full" style={{ transform: `rotate(${rotate}deg)` }}>
        <svg
          aria-hidden
          className="h-full w-full"
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={d} fill={tones[tone]} />
        </svg>
      </div>
    </div>
  );
};
