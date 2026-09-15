import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-field border border-fog bg-snow px-4 py-2 text-[15px] text-ink shadow-card-flat transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate/70 focus-visible:outline-none focus-visible:border-sky focus-visible:ring-2 focus-visible:ring-sky/15 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
