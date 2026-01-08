import { ChevronDown, Settings2 } from "lucide-react";
import { forwardRef, memo, useEffect, useState } from "react";
import type { ExecutorConfig } from "shared/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  currentProfile: ExecutorConfig | null;
  selectedVariant: string | null;
  onChange: (variant: string | null) => void;
  disabled?: boolean;
  className?: string;
};

const VariantSelectorInner = forwardRef<HTMLButtonElement, Props>(
  ({ currentProfile, selectedVariant, onChange, disabled, className }, ref) => {
    // Bump-effect animation when cycling through variants
    const [isAnimating, setIsAnimating] = useState(false);
    useEffect(() => {
      if (!currentProfile) return;
      setIsAnimating(true);
      const t = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(t);
    }, [selectedVariant, currentProfile]);

    const hasVariants =
      currentProfile && Object.keys(currentProfile).length > 0;

    if (!currentProfile) return null;

    if (!hasVariants) {
      return (
        <Button
          className={cn(
            "flex h-10 w-24 items-center justify-between px-2",
            className
          )}
          disabled
          ref={ref}
          size="sm"
          variant="outline"
        >
          <span className="flex-1 truncate text-left text-xs">Default</span>
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              "flex items-center justify-between px-2 transition-all",
              isAnimating && "scale-105 bg-accent",
              className
            )}
            disabled={disabled}
            ref={ref}
            size="sm"
            variant="secondary"
          >
            <Settings2 className="mr-1 h-3 w-3 flex-shrink-0" />
            <span className="flex-1 truncate text-left text-xs">
              {selectedVariant || "DEFAULT"}
            </span>
            <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {Object.entries(currentProfile).map(([variantLabel]) => (
            <DropdownMenuItem
              className={selectedVariant === variantLabel ? "bg-accent" : ""}
              key={variantLabel}
              onClick={() => onChange(variantLabel)}
            >
              {variantLabel}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

VariantSelectorInner.displayName = "VariantSelector";
export const VariantSelector = memo(VariantSelectorInner);
