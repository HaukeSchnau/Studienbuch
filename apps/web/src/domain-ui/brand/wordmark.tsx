import { cn } from "#/ui/cn.ts";

/**
 * App icon plus name. `tone` picks the text colour for the surface it sits on: the green header
 * takes `on-primary`, everything else takes the brand green.
 */
export const Wordmark = ({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "on-primary";
}) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <img
      alt=""
      className="size-8 rounded-[0.6rem] shadow-card"
      height={32}
      src="/brand/icon-512.png"
      width={32}
    />
    <span
      className={cn(
        "text-lg font-extrabold tracking-tight",
        tone === "on-primary" ? "text-white" : "text-primary-text",
      )}
    >
      Studienbuch
    </span>
  </span>
);
