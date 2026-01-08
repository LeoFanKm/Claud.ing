import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const ToggleGroup = ToggleGroupPrimitive.Root;

const toggleGroupItemVariants = cva(
  "inline-flex h-4 w-4 items-center justify-center rounded-sm font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      active: {
        true: "bg-primary text-primary-foreground",
        false:
          "text-primary-foreground/70 hover:bg-accent hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

interface ToggleGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>,
    VariantProps<typeof toggleGroupItemVariants> {}

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  ToggleGroupItemProps
>(({ className, active, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    className={cn(toggleGroupItemVariants({ active }), className)}
    ref={ref}
    {...props}
  />
));
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
