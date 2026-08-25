import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "#/ui/cn.ts";

const buttonVariants = cva(
  "press inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-neutral-400 focus-visible:ring-[3px] focus-visible:ring-neutral-400/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red-600 aria-invalid:ring-red-600/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-neutral-900 text-white hover:bg-neutral-800",
        destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/20",
        outline: "border border-neutral-300 bg-transparent shadow-xs hover:bg-neutral-100",
        secondary: "bg-neutral-200 text-neutral-950 hover:bg-neutral-300",
        ghost: "hover:bg-neutral-100",
        link: "text-neutral-950 underline-offset-4 hover:underline",
        // The app's own call to action: a blue pill, the colour Flutter fills ElevatedButton with.
        brand: "bg-accent text-white shadow-float hover:bg-accent-sec focus-visible:ring-accent/40",
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
