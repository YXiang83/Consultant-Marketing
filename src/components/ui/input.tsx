import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
          className,
        )}
        {...props}
      />
    );
  },
);
