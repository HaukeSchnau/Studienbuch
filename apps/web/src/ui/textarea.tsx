import * as React from "react";

import { cn } from "#/ui/cn.ts";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-32 w-full rounded-3xl border-0 bg-neutral-sec/60 px-5 py-4 text-base text-ink transition-shadow outline-none placeholder:text-neutral focus-visible:ring-[3px] focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px] aria-invalid:ring-danger/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
