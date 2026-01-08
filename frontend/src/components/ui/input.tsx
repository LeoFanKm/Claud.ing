import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCommandEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCommandShiftEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      onKeyDown,
      onCommandEnter,
      onCommandShiftEnter,
      ...props
    },
    ref
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.currentTarget.blur();
      }
      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        if (e.metaKey && e.shiftKey) {
          onCommandShiftEnter?.(e);
        } else {
          onCommandEnter?.(e);
        }
      }
      onKeyDown?.(e);
    };

    return (
      <input
        className={cn(
          "flex h-10 w-full border bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:font-medium file:text-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onKeyDown={handleKeyDown}
        ref={ref}
        type={type}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
export { Input };
