import * as React from "react";

import { cn } from "#/ui/cn.ts";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-full border-0 bg-neutral-sec/60 px-5 text-base text-ink transition-[box-shadow,transform] focus-visible:-translate-y-0.5 outline-none placeholder:text-neutral disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-[3px] focus-visible:ring-accent/40",
        "aria-invalid:ring-[3px] aria-invalid:ring-danger/30",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
