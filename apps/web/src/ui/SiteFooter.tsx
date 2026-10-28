import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="column">
      <Link to="/">Studienbuch</Link>
      <Link to="/impressum">Impressum</Link>
      <Link to="/datenschutz">Datenschutz</Link>
    </footer>
  );
}
