import { Organization } from "@stu/core/organization";
import { Link } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut, Plus, ShieldCheck, UserRound, UserRoundPen } from "lucide-react";
import { initials } from "#/domain-ui/person-name.ts";
import { useSignOut } from "#/features/auth/use-sign-out.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/ui/dropdown-menu.tsx";
import { useShell } from "./shell-state.tsx";
import { useContextNavigation } from "./use-context-navigation.ts";
import type { ShellContext } from "./contexts.ts";

/** The value a context takes in the menu: the same segments its path is built from. */
const contextValue = (context: ShellContext) => Organization.contextSegments(context.ref).join("/");

/**
 * Who you are, where you are, and every way out — in one control.
 *
 * This replaces a switcher that appeared only for the handful of people holding more than one
 * context. Everyone else got a card that looked exactly like a control and did nothing, and below
 * `md` they got nothing at all: no school name, no name of their own, and no way to sign out
 * without first finding "Mein Konto" in the bottom bar.
 *
 * Switching context is only one of the things this menu does, which is why it is a menu rather than
 * a select. A select is a form field — it answers "which value", and signing out is not a value.
 */
export const AccountMenu = ({ compact = false }: { readonly compact?: boolean }) => {
  const { account, context, contexts } = useShell();
  const goToContext = useContextNavigation();
  const signOut = useSignOut();

  const access = context.access;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Konto und Bereiche"
        className={
          compact
            ? "press flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-primary-des focus-visible:ring-2 focus-visible:ring-primary-pale focus-visible:outline-none"
            : "press flex w-full items-center gap-3 rounded-full bg-primary-des px-3 py-2.5 text-left hover:bg-primary-pale/25 focus-visible:ring-2 focus-visible:ring-primary-pale focus-visible:outline-none"
        }
        data-testid="account-menu"
      >
        <ContextAvatar accountName={account.user.name} context={context} />
        {compact ? (
          <span className="max-w-32 truncate text-sm font-semibold text-ink">{context.title}</span>
        ) : (
          <span className="min-w-0 grow">
            <span className="block truncate text-sm font-semibold text-ink">{context.title}</span>
            <span className="block truncate text-xs text-ink-soft">{context.subtitle}</span>
          </span>
        )}
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-ink-soft" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align={compact ? "end" : "start"} className="max-w-[min(20rem,90vw)]">
        <DropdownMenuLabel>
          {/* Who is signed in, which until now was legible on exactly one screen in the product. */}
          <span className="block truncate text-sm font-semibold text-ink">{account.user.name}</span>
          <span className="block truncate font-normal">{account.user.email}</span>
        </DropdownMenuLabel>

        {/* Keep the unfinished school profile next to the context it belongs to. */}
        {access !== undefined && access.profile === null ? (
          <DropdownMenuItem asChild>
            <Link search={{ access: access.id }} to="/einrichten">
              <UserRoundPen /> Profil einrichten
            </Link>
          </DropdownMenuItem>
        ) : null}

        {contexts.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Bereich wechseln</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              onValueChange={(next) => {
                const chosen = contexts.find((candidate) => contextValue(candidate) === next);
                if (chosen !== undefined) goToContext(chosen.ref);
              }}
              value={contextValue(context)}
            >
              {contexts.map((candidate) => (
                <DropdownMenuRadioItem
                  key={contextValue(candidate)}
                  value={contextValue(candidate)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{candidate.title}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {candidate.subtitle}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/konto">
            <UserRound /> Mein Konto
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/aktivieren">
            <Plus /> Schule hinzufügen
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="focus:bg-danger-des focus:text-danger-sec"
          data-testid="sign-out"
          onSelect={() => void signOut()}
        >
          <LogOut /> Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * School contexts carry the account's initials. The operator shield identifies authority rather
 * than a second kind of person.
 */
const ContextAvatar = ({
  context,
  accountName,
}: {
  readonly context: ShellContext;
  readonly accountName: string;
}) => (
  <span
    aria-hidden
    className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-primary-text"
  >
    {context.ref._tag === "Operator" ? <ShieldCheck className="size-4.5" /> : initials(accountName)}
  </span>
);
