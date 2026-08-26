import { Organization } from "@stu/core/organization";
import { initials } from "#/domain-ui/person-name.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/ui/select.tsx";
import { useContextNavigation } from "./use-context-navigation.ts";
import type { ShellContext } from "./contexts.ts";

/** The value a context takes in the switcher: the same segments its path is built from. */
const contextValue = (context: ShellContext) => Organization.contextSegments(context.ref).join("/");

/**
 * How a person moves between the lives they lead here.
 *
 * Rendered only when there is more than one, which for almost everyone is never: a student at one
 * school should not be asked to understand that contexts exist. It appears the moment a second
 * access is redeemed or an operator grant is made, and its absence is the design working.
 *
 * Switching lands on the new context's first destination rather than the same destination in it.
 * There is no reason to think a teacher's "Meine Kurse" has a counterpart in the operator context,
 * and guessing at one produces dead links.
 */
export const ContextSwitcher = ({
  active,
  compact = false,
  contexts,
}: {
  readonly active: ShellContext;
  /** The narrow presentation used in the header below `md`, where the rail is hidden. */
  readonly compact?: boolean;
  readonly contexts: ReadonlyArray<ShellContext>;
}) => {
  const goToContext = useContextNavigation();

  if (contexts.length < 2) {
    return compact ? null : <ContextBadge context={active} />;
  }

  return (
    <Select
      onValueChange={(next) => {
        const chosen = contexts.find((context) => contextValue(context) === next);
        if (chosen !== undefined) goToContext(chosen.ref);
      }}
      value={contextValue(active)}
    >
      <SelectTrigger
        aria-label="Bereich wechseln"
        className="w-full"
        data-testid="context-switcher"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {contexts.map((context) => (
          <SelectItem key={contextValue(context)} value={contextValue(context)}>
            {compact ? context.title : `${context.title} · ${context.subtitle}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/**
 * What a single-context person sees instead of a switcher: which school this is, and who they are
 * in it. Not a control, because there is nothing to choose.
 */
const ContextBadge = ({ context }: { readonly context: ShellContext }) => {
  const displayName = context.access?.displayName ?? null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-primary-des px-3 py-2.5">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-primary-text"
      >
        {displayName === null ? "?" : initials(displayName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{context.title}</span>
        <span className="block truncate text-xs text-ink-soft">{context.subtitle}</span>
      </span>
    </div>
  );
};
