import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "#/ui/cn.ts";

/*
 * The generated component arrived with the grey defaults it ships with — a near-black `default`, a
 * `neutral-300` outline and a grey focus ring — and only `brand` was ever given the product's own
 * colours. Every other button therefore read as belonging to some other application: the account
 * page in particular was a column of grey pills in a green product.
 *
 * The palette below is the same one the rest of the interface is built from, so a button no longer
 * has to opt in to looking like Studienbuch. `brand` keeps the blue, because that is the colour
 * Flutter fills `ElevatedButton` with and the app this supersedes uses it for the one action a
 * screen is asking for; `default` is now the green, which is what the brand actually is.
 */
const buttonVariants = cva(
  "press inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-danger/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-punch",
        destructive: "bg-danger text-white hover:bg-danger-sec focus-visible:ring-danger/30",
        outline:
          "border border-neutral-sec bg-white text-ink shadow-card hover:border-primary-pale/60 hover:bg-primary-des",
        secondary: "bg-primary-des text-primary-text hover:bg-primary-pale/25",
        ghost: "text-ink hover:bg-primary-des hover:text-primary-text",
        link: "text-accent underline-offset-4 hover:underline",
        // The app's own call to action: a blue pill, the colour Flutter fills ElevatedButton with.
        brand: "bg-accent text-white shadow-float hover:bg-accent-sec",
      },
      radius: {
        default: "",
        pill: "rounded-full",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xl: "h-12 px-7 text-base has-[>svg]:px-6",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      radius: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  radius = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-radius={radius}
      data-size={size}
      className={cn(buttonVariants({ variant, radius, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
