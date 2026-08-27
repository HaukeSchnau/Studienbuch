import * as React from "react";
import { CheckIcon } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";

import { cn } from "#/ui/cn.ts";

/**
 * A menu hung off a control, themed the way the rest of the product is.
 *
 * Deliberately smaller than the usual generated component: only the pieces the application shell
 * actually uses. Submenus, checkbox items, groups and shortcuts are absent because nothing here has
 * ever wanted one, and an unused branch of a primitive is a branch nobody notices breaking.
 */
function DropdownMenu({ ...props }: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-(--radix-dropdown-menu-trigger-width) origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto rounded-3xl bg-white p-2 shadow-float data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

/**
 * The shared look of every row. Radix moves focus with the keyboard *and* with the pointer, so
 * `focus:` alone covers hover as well — a separate `hover:` rule would double up and, worse, could
 * highlight two rows at once.
 */
const itemStyles =
  "relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm text-ink outline-hidden select-none focus:bg-primary-des focus:text-primary-text data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(itemStyles, className)}
      {...props}
    />
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioGroup>) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/**
 * The tick sits on the right and its space is reserved on every row, so that choosing a different
 * one does not shift the labels sideways.
 */
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(itemStyles, "pr-9", className)}
      {...props}
    >
      {children}
      <span className="absolute right-3 grid size-4 place-items-center text-primary-text">
        <MenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </MenuPrimitive.ItemIndicator>
      </span>
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-3 pt-2 pb-1 text-xs font-semibold text-ink-soft", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("my-2 h-px bg-neutral-sec", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
