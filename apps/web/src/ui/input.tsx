import * as React from "react";

import { cn } from "#/ui/cn.ts";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-neutral-300 bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-neutral-900 selection:text-white file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-neutral-400 focus-visible:ring-[3px] focus-visible:ring-neutral-400/50",
        "aria-invalid:border-red-600 aria-invalid:ring-red-600/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
