import {
  ArrowBigLeft,
  MoreHorizontal,
  MousePointerClick,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ClickedEntry } from "@/contexts/ClickedElementsProvider";
import { useClickedElements } from "@/contexts/ClickedElementsProvider";
import { Badge } from "../ui/badge";

export type Props = Readonly<{
  isEditable: boolean;
  appendInstructions?: (text: string) => void;
}>;

const MAX_VISIBLE_ELEMENTS = 5;
const MAX_BADGES = 6;

type ComponentInfo = ClickedEntry["payload"]["components"][number];

// Build component chain from inner-most to outer-most for banner display
function buildChainInnerToOuterForBanner(entry: ClickedEntry) {
  const comps: ComponentInfo[] = entry.payload.components ?? [];
  const s: ComponentInfo = entry.payload.selected;

  // Start with selected as innermost
  const innerToOuter = [s];

  // Add components that aren't duplicates
  const selectedKey = `${s.name}|${s.pathToSource}|${s.source?.lineNumber}|${s.source?.columnNumber}`;
  comps.forEach((c) => {
    const compKey = `${c.name}|${c.pathToSource}|${c.source?.lineNumber}|${c.source?.columnNumber}`;
    if (compKey !== selectedKey) {
      innerToOuter.push(c);
    }
  });

  return innerToOuter;
}

function getVisibleElements(
  elements: ClickedEntry[],
  max = MAX_VISIBLE_ELEMENTS
): { visible: ClickedEntry[]; total: number; hasMore: boolean } {
  // Show most recent elements first
  const reversed = [...elements].reverse();
  const visible = reversed.slice(0, max);
  return {
    visible,
    total: elements.length,
    hasMore: elements.length > visible.length,
  };
}

export function ClickedElementsBanner() {
  const [isExpanded] = useState(false);
  const { elements, removeElement } = useClickedElements();

  // Early return if no elements
  if (elements.length === 0) return null;

  const { visible: visibleElements } = getVisibleElements(
    elements,
    isExpanded ? elements.length : MAX_VISIBLE_ELEMENTS
  );

  return (
    <div className="flex flex-col gap-2 bg-bg py-2">
      {visibleElements.map((element) => {
        return (
          <ClickedEntryCard
            element={element}
            key={element.id}
            onDelete={() => removeElement(element.id)}
          />
        );
      })}
    </div>
  );
}

const ClickedEntryCard = ({
  element,
  onDelete,
}: {
  element: ClickedEntry;
  onDelete: () => void;
}) => {
  const { selectComponent } = useClickedElements();
  const chain = useMemo(
    () => buildChainInnerToOuterForBanner(element),
    [element]
  );
  const selectedDepth = element.selectedDepth ?? 0;

  // Truncate from the right side (outermost components), keep leftmost (innermost)
  const overflowRight = Math.max(0, chain.length - MAX_BADGES);
  const display = chain.slice(0, MAX_BADGES);

  const handleSelect = (visibleIdx: number) => {
    // Since we kept the leftmost items as-is, visibleIdx === depthFromInner
    selectComponent(element.id, visibleIdx);
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <MousePointerClick aria-hidden className="h-4 w-4 shrink-0 text-info" />

      <div className="flex items-center gap-1 overflow-hidden">
        {display.map((component, i) => {
          const depthFromInner = i; // Simple mapping since we keep left side
          const isDownstream = depthFromInner < selectedDepth;
          const isSelected = depthFromInner === selectedDepth;

          return (
            <div className="flex items-center" key={`${component.name}-${i}`}>
              {i > 0 && (
                <ArrowBigLeft aria-hidden className="h-4 w-4 opacity-60" />
              )}
              <button
                aria-pressed={isSelected}
                className={`inline-flex items-center rounded px-2 py-0.5 text-sm transition ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:opacity-90"
                } ${isDownstream ? "cursor-pointer opacity-50" : ""}`}
                onClick={() => handleSelect(i)}
                title={component.name}
                type="button"
              >
                &lt;{component.name}/&gt;
              </button>
            </div>
          );
        })}

        {overflowRight > 0 && (
          <div className="flex items-center">
            <ArrowBigLeft aria-hidden className="h-4 w-4 opacity-60" />
            <Badge
              className="select-none text-xs opacity-70"
              title={`${overflowRight} more outer components`}
              variant="secondary"
            >
              <MoreHorizontal className="h-3 w-3" />
              <span className="ml-1">{overflowRight}</span>
            </Badge>
          </div>
        )}
      </div>

      <Button
        aria-label="Delete entry"
        className="ml-auto px-0"
        onClick={onDelete}
        size="sm"
        variant="ghost"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
