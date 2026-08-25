import { useEffect, useState } from "react";

import { externalLinks, sectionHref, sectionIds } from "#/domain-ui/brand/links.ts";
import { Underline } from "#/domain-ui/brand/underline.tsx";

const navItems = [
  { id: sectionIds.capabilities, label: "Funktionen" },
  { id: sectionIds.schools, label: "Für Schulen" },
  { id: sectionIds.app, label: "App laden" },
] as const;

/**
 * Which of the linked sections is currently being read.
 *
 * An IntersectionObserver rather than a scroll handler: the browser does the geometry itself and
 * only calls back when something actually crosses, where a scroll listener would run on every
 * frame of every scroll to compute the same answer.
 *
 * The band is the middle of the viewport rather than its top, so the highlight follows what is
 * being looked at instead of whatever happens to be touching the top edge.
 */
function useActiveSection(ids: ReadonlyArray<string>): string | undefined {
  const [active, setActive] = useState<string>();

  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id);
          } else {
            visible.delete(entry.target.id);
          }
        }
        // Walked in document order and kept, so crossing a boundary while two sections overlap
        // always resolves to the later one. `findLast` would say this in a line but is ES2023, and
        // this file is not worth raising the library target for.
        let latest: string | undefined;
        for (const id of ids) {
          if (visible.has(id)) {
            latest = id;
          }
        }
        setActive(latest);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element !== null) {
        observer.observe(element);
      }
    }
    return () => {
      observer.disconnect();
    };
  }, [ids]);

  return active;
}

const linkClass =
  "nav-link press relative rounded-sm text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none sm:text-base";

/**
 * The legacy site's chrome: a single green pill, only as wide as its links, floating centred above
 * a white page.
 *
 * The current section is marked with the brand's own swoosh rather than a sliding indicator or a
 * colour change. It reuses the gesture already under the headline, needs no measuring of link
 * positions, and survives a resize or a late font swap without recalculating anything — and the
 * same stroke draws on hover, so pointing at a link previews what arriving there will look like.
 */
export const SiteHeader = () => {
  const active = useActiveSection(navItems.map((item) => item.id));

  return (
    <header className="sticky top-0 z-50 flex justify-center px-6 pt-6 sm:pt-8">
      <nav
        aria-label="Hauptnavigation"
        className="flex w-fit items-center gap-5 rounded-full bg-primary-text px-6 py-3.5 text-white shadow-float sm:gap-8 sm:px-8"
      >
        {navItems.map((item) => (
          <a
            aria-current={active === item.id ? "true" : undefined}
            className={linkClass}
            data-active={active === item.id ? "true" : "false"}
            href={sectionHref(item.id)}
            key={item.id}
          >
            <span className="nav-label">{item.label}</span>
            <span aria-hidden className="nav-sizer">
              {item.label}
            </span>
            <Underline className="nav-underline -bottom-1.5" />
          </a>
        ))}
        <a className={`${linkClass} hidden sm:inline`} href={externalLinks.schoolContact}>
          <span className="nav-label">Kontakt</span>
          <span aria-hidden className="nav-sizer">
            Kontakt
          </span>
          <Underline className="nav-underline -bottom-1.5" />
        </a>
      </nav>
    </header>
  );
};
