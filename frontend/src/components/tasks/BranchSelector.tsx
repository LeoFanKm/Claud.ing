import { ArrowDown, GitBranch as GitBranchIcon, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { GitBranch } from "shared/types";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

type Props = {
  branches: GitBranch[];
  selectedBranch: string | null;
  onBranchSelect: (branch: string) => void;
  placeholder?: string;
  className?: string;
  excludeCurrentBranch?: boolean;
  disabledTooltip?: string;
};

type RowProps = {
  branch: GitBranch;
  isSelected: boolean;
  isHighlighted: boolean;
  isDisabled: boolean;
  onHover: () => void;
  onSelect: () => void;
  disabledTooltip?: string;
};

const BranchRow = memo(function BranchRow({
  branch,
  isSelected,
  isHighlighted,
  isDisabled,
  onHover,
  onSelect,
  disabledTooltip,
}: RowProps) {
  const { t } = useTranslation(["common"]);
  const classes =
    (isSelected ? "bg-accent text-accent-foreground " : "") +
    (isDisabled ? "opacity-50 cursor-not-allowed " : "") +
    (!isSelected && isHighlighted ? "bg-accent/70 ring-2 ring-accent " : "") +
    "transition-none";

  const nameClass = branch.is_current ? "font-medium" : "";

  const item = (
    <DropdownMenuItem
      className={classes.trim()}
      disabled={isDisabled}
      onMouseEnter={onHover}
      onSelect={onSelect}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className={`${nameClass} min-w-0 flex-1 truncate`}>
          {branch.name}
        </span>
        <div className="flex flex-shrink-0 gap-1">
          {branch.is_current && (
            <span className="rounded bg-background px-1 text-xs">
              {t("branchSelector.badges.current")}
            </span>
          )}
          {branch.is_remote && (
            <span className="rounded bg-background px-1 text-xs">
              {t("branchSelector.badges.remote")}
            </span>
          )}
        </div>
      </div>
    </DropdownMenuItem>
  );

  if (isDisabled && disabledTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block">{item}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{disabledTooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return item;
});

function BranchSelector({
  branches,
  selectedBranch,
  onBranchSelect,
  placeholder,
  className = "",
  excludeCurrentBranch = false,
  disabledTooltip,
}: Props) {
  const { t } = useTranslation(["common"]);
  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const effectivePlaceholder = placeholder ?? t("branchSelector.placeholder");
  const defaultDisabledTooltip = t("branchSelector.currentDisabled");

  const filteredBranches = useMemo(() => {
    let filtered = branches;

    if (branchSearchTerm.trim()) {
      const q = branchSearchTerm.toLowerCase();
      filtered = filtered.filter((b) => b.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [branches, branchSearchTerm]);

  const handleBranchSelect = useCallback(
    (branchName: string) => {
      onBranchSelect(branchName);
      setBranchSearchTerm("");
      setHighlightedIndex(null);
      setOpen(false);
    },
    [onBranchSelect]
  );

  const isBranchDisabled = useCallback(
    (branch: GitBranch) => excludeCurrentBranch && branch.is_current,
    [excludeCurrentBranch]
  );

  useEffect(() => {
    if (
      highlightedIndex !== null &&
      highlightedIndex >= filteredBranches.length
    ) {
      setHighlightedIndex(null);
    }
  }, [filteredBranches, highlightedIndex]);

  useEffect(() => {
    setHighlightedIndex(null);
  }, [branchSearchTerm]);

  const moveHighlight = useCallback(
    (delta: 1 | -1) => {
      if (filteredBranches.length === 0) return;

      const start = highlightedIndex ?? -1;
      let next = start;

      for (let attempts = 0; attempts < filteredBranches.length; attempts++) {
        next =
          (next + delta + filteredBranches.length) % filteredBranches.length;
        if (!isBranchDisabled(filteredBranches[next])) {
          setHighlightedIndex(next);
          virtuosoRef.current?.scrollIntoView({
            index: next,
            behavior: "auto",
          });
          return;
        }
      }
      setHighlightedIndex(null);
    },
    [filteredBranches, highlightedIndex, isBranchDisabled]
  );

  const attemptSelect = useCallback(() => {
    if (highlightedIndex == null) return;
    const branch = filteredBranches[highlightedIndex];
    if (!branch) return;
    if (isBranchDisabled(branch)) return;
    handleBranchSelect(branch.name);
  }, [
    highlightedIndex,
    filteredBranches,
    isBranchDisabled,
    handleBranchSelect,
  ]);

  return (
    <DropdownMenu
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setBranchSearchTerm("");
          setHighlightedIndex(null);
        }
      }}
      open={open}
    >
      <DropdownMenuTrigger asChild>
        <Button
          className={`w-full justify-between text-xs ${className}`}
          size="sm"
          variant="outline"
        >
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <GitBranchIcon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {selectedBranch || effectivePlaceholder}
            </span>
          </div>
          <ArrowDown className="h-3 w-3 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <TooltipProvider>
        <DropdownMenuContent className="w-80">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                onChange={(e) => setBranchSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  switch (e.key) {
                    case "ArrowDown":
                      e.preventDefault();
                      e.stopPropagation();
                      moveHighlight(1);
                      return;
                    case "ArrowUp":
                      e.preventDefault();
                      e.stopPropagation();
                      moveHighlight(-1);
                      return;
                    case "Enter":
                      e.preventDefault();
                      e.stopPropagation();
                      attemptSelect();
                      return;
                    case "Escape":
                      e.preventDefault();
                      e.stopPropagation();
                      setOpen(false);
                      return;
                    case "Tab":
                      return;
                    default:
                      e.stopPropagation();
                  }
                }}
                placeholder={t("branchSelector.searchPlaceholder")}
                ref={searchInputRef}
                value={branchSearchTerm}
              />
            </div>
          </div>
          <DropdownMenuSeparator />
          {filteredBranches.length === 0 ? (
            <div className="p-2 text-center text-muted-foreground text-sm">
              {t("branchSelector.empty")}
            </div>
          ) : (
            <Virtuoso
              computeItemKey={(idx) => filteredBranches[idx]?.name ?? idx}
              itemContent={(idx) => {
                const branch = filteredBranches[idx];
                const isDisabled = isBranchDisabled(branch);
                const isHighlighted = idx === highlightedIndex;
                const isSelected = selectedBranch === branch.name;

                return (
                  <BranchRow
                    branch={branch}
                    disabledTooltip={
                      isDisabled
                        ? (disabledTooltip ?? defaultDisabledTooltip)
                        : undefined
                    }
                    isDisabled={isDisabled}
                    isHighlighted={isHighlighted}
                    isSelected={isSelected}
                    onHover={() => setHighlightedIndex(idx)}
                    onSelect={() => handleBranchSelect(branch.name)}
                  />
                );
              }}
              ref={virtuosoRef}
              style={{ height: "16rem" }}
              totalCount={filteredBranches.length}
            />
          )}
        </DropdownMenuContent>
      </TooltipProvider>
    </DropdownMenu>
  );
}

export default BranchSelector;
