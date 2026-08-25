import { cn } from "#/ui/cn.ts";

/**
 * The legacy site's colour blobs.
 *
 * Each outline is a closed loop whose radius is a sum of low-frequency harmonics — so it varies by
 * more than two to one around the circle, but only gently between neighbouring samples. That is
 * what keeps them round everywhere while still being irregular. Sampling a handful of arbitrary
 * radii instead, which was the previous approach, puts a corner at every tight minimum.
 *
 * Each is normalised to sit inside its own square box with room to spare, so the outline is never
 * cropped by the SVG viewport. Position them so a good part hangs off the side of the page: the
 * layout's `overflow-x-clip` cuts that off into the single straight edge the legacy shapes had,
 * and nothing else is ever cut.
 */

const blobs = {
  /** A deep waist down one side, almost folded in half. */
  kidney:
    "M310 44C350 39 369 38 410 46C452 54 476 59 510 84C544 110 559 130 575 169C592 208 590 232 589 273C588 314 582 332 570 368C558 405 552 420 532 450C511 481 500 492 472 516C445 540 433 547 399 567C365 588 352 602 310 617C268 631 239 645 196 636C152 627 121 611 100 573C78 534 81 495 91 449C101 403 131 382 148 351C166 320 174 323 176 299C177 274 159 266 155 233C151 200 143 173 157 140C170 106 186 90 218 70C250 50 270 49 310 44Z",
  /** Two lobes with a dip between them along the bottom. */
  twin: "M355 98C395 80 427 67 467 78C507 90 528 116 550 153C572 190 565 219 575 258C585 297 588 305 601 342C613 378 636 396 636 434C636 473 632 504 603 528C573 552 536 553 495 551C454 550 434 525 405 520C376 516 381 517 355 530C330 544 320 572 282 586C245 601 214 611 173 602C133 593 111 575 84 542C57 508 50 483 44 440C38 397 41 371 58 332C74 294 93 277 125 252C156 226 177 228 208 210C240 192 245 188 275 165C306 142 316 116 355 98Z",
  /** Twin lobes again, pinched on the other side and rounder. */
  pinch:
    "M304 52C344 64 361 80 389 106C417 132 422 150 440 178C457 207 455 217 473 243C490 268 501 271 525 301C549 332 575 348 590 391C605 434 612 468 596 510C581 551 555 571 515 593C476 615 448 610 405 617C361 625 347 627 304 630C261 634 238 647 196 636C155 625 127 614 103 579C80 544 82 510 84 468C86 425 107 407 113 374C120 341 119 340 113 307C108 274 88 257 87 215C85 174 85 142 107 107C130 71 155 55 196 44C236 33 264 39 304 52Z",
  /** Mostly full, with one soft bite taken out of a flank. */
  notch:
    "M307 90C340 107 343 127 371 142C399 156 405 151 441 159C478 166 510 157 550 179C590 200 619 220 636 261C653 302 645 333 632 377C618 420 597 435 571 472C545 509 536 524 505 555C473 586 458 610 417 622C376 634 346 633 307 615C268 597 252 568 228 535C204 503 208 483 190 458C172 434 165 435 142 415C118 394 98 389 78 360C58 330 48 311 44 273C40 235 44 214 59 176C74 139 86 118 117 94C149 69 172 59 212 58C251 57 274 73 307 90Z",
  /** The calmest: a broad mass easing into a shallow hollow. */
  swell:
    "M346 44C386 48 406 62 441 83C475 103 485 118 512 145C539 172 552 182 572 213C591 245 600 261 608 298C615 334 612 352 608 390C604 429 601 444 588 484C574 523 571 548 543 579C515 611 493 631 452 636C411 641 381 627 346 603C310 578 304 547 282 519C260 492 264 485 239 470C215 456 196 465 164 449C132 432 104 421 85 390C66 358 66 333 72 296C78 258 94 244 114 210C134 177 142 164 169 134C196 104 208 84 244 65C281 47 305 40 346 44Z",
} as const;

/** Every blob is drawn in the same square box, so callers can size them with a single utility. */
const BLOB_VIEW_BOX = "0 0 680 680";

const tones = {
  green: "var(--color-primary-pale)",
  blue: "var(--color-accent-pale)",
} as const;

/**
 * One blob. The caller positions and sizes it, and is expected to pull it past the edge of the page
 * with a negative inset.
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
}) => (
  // The drift animation owns the outer element's transform, so the rotation needs its own element
  // or the two overwrite each other.
  <div aria-hidden className={cn("drift pointer-events-none absolute -z-10 opacity-45", className)}>
    <div className="h-full w-full" style={{ transform: `rotate(${rotate}deg)` }}>
      <svg
        aria-hidden
        className="h-full w-full"
        viewBox={BLOB_VIEW_BOX}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={blobs[blob]} fill={tones[tone]} />
      </svg>
    </div>
  </div>
);
