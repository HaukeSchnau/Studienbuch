import { Motion } from "#/ui/Motion.ts";
import { Underline } from "#/ui/Underline.tsx";

import { Site } from "./Site.ts";

const items = [
  { id: Site.sections.features, label: "Funktionen", wide: false },
  { id: Site.sections.privacy, label: "Verschlüsselung", wide: true },
  { id: Site.sections.schools, label: "Für Schulen", wide: false },
  { id: Site.sections.app, label: "App laden", wide: false },
] as const;

const ids = items.map((item) => item.id);

function NavLink({
  href,
  label,
  active = false,
  wide = false,
}: {
  href: string;
  label: string;
  active?: boolean;
  wide?: boolean;
}) {
  return (
    <a
      aria-current={active ? "true" : undefined}
      className={`nav-link press${wide ? " nav-link-wide" : ""}`}
      data-active={active}
      href={href}
    >
      {/* The label sits on an invisible copy of itself at the heaviest weight, so the link is
          always as wide as its boldest state and the pill never resizes. */}
      <span className="nav-label">{label}</span>
      <span aria-hidden className="nav-sizer">
        {label}
      </span>
      <Underline className="nav-underline" />
    </a>
  );
}

/**
 * The legacy site's chrome: one green pill, as wide as its links, floating above the page. The
 * section being read gets the swoosh under its link, and hovering a link previews it.
 */
export function SiteHeader() {
  const active = Motion.useActiveSection(ids);

  return (
    <header className="site-header">
      <nav aria-label="Hauptnavigation" className="site-nav">
        {items.map((item) => (
          <NavLink
            active={active === item.id}
            href={Site.sectionHref(item.id)}
            key={item.id}
            label={item.label}
            wide={item.wide}
          />
        ))}
        <NavLink href={Site.webApp} label="Anmelden" />
      </nav>
    </header>
  );
}
