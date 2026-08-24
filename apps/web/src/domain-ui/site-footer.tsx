import { copy } from "#/features/marketing/copy.ts";
import { cn } from "#/ui/cn.ts";

/**
 * The legacy footer, kept almost word for word. "Eine Hauke Schnau Produktion" is the line that
 * tells you a person built this rather than a company, and it is worth more than a feature bullet.
 */
export const SiteFooter = ({
  className,
  tone = "ink",
}: {
  className?: string;
  tone?: "ink" | "light";
}) => (
  <footer
    className={cn(
      "flex flex-col items-center gap-2 py-12",
      tone === "light" ? "text-white" : "text-ink",
      className,
    )}
  >
    <p className="opacity-80">{copy.footer.credit}</p>

    <ul className="flex gap-4 text-sm opacity-60">
      {copy.footer.legal.map(({ href, label }) => (
        <li key={href}>
          <a className="hover:underline" href={href}>
            {label}
          </a>
        </li>
      ))}
    </ul>
  </footer>
);
