import { Search } from "lucide-react";
import * as React from "react";
import type { Project } from "shared/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  onClear?: () => void;
  project: Project | null;
}

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, value = "", onChange, disabled = false, project }, ref) => {
    if (disabled) {
      return null;
    }

    return (
      <div className={cn("relative w-64 sm:w-72", className)}>
        <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 bg-muted pr-14 pl-8"
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={project ? `Search ${project.name}...` : "Search..."}
          ref={ref}
          value={value}
        />
      </div>
    );
  }
);

SearchBar.displayName = "SearchBar";
