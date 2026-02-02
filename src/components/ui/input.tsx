import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 min-h-8 w-full px-3 border border-surface-border box-border bg-input text-inherit outline-none text-sm placeholder:text-muted leading-none",
        "focus:border-accent transition-colors",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
