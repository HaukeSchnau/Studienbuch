import { Link } from "@tanstack/react-router";

import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { copy } from "#/features/marketing/copy.ts";
import { cn } from "#/ui/cn.ts";

const tones = {
  pale: "bg-primary-pale text-white",
  surface: "bg-surface text-ink",
  notebook: "bg-notebook text-white",
} as const;

/**
 * The floating pill navigation the legacy site opened with: no bar, no border, no full-width
 * background, just a rounded block sitting in the top margin.
 *
 * The `tone` picks which surface it sits on, because that is the part each design variant needs to
 * decide for itself.
 */
export const SiteNav = ({
  className,
  tone = "pale",
}: {
  className?: string;
  tone?: keyof typeof tones;
}) => (
  <nav
    className={cn(
      "mx-auto flex w-fit items-center gap-6 rounded-full px-6 py-3 shadow-float sm:gap-8 sm:px-8",
      tones[tone],
      className,
    )}
  >
    <Link className="text-lg" to="/">
      <Wordmark />
    </Link>

    <ul className="hidden items-center gap-6 font-bold sm:flex">
      {copy.nav.map(({ href, label }) => (
        <li key={href}>
          <a className="opacity-90 transition-opacity hover:opacity-100" href={href}>
            {label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
);
