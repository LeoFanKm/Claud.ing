import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useCallback, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";

export type LayoutMode = "preview" | "diffs" | null;

/**
 * Breakpoint type for responsive layout decisions
 * - 'sm': 640px - 767px (small mobile/large phone)
 * - 'md': 768px - 1023px (tablet portrait)
 * - 'lg': 1024px - 1279px (tablet landscape / small laptop)
 * - 'xl': 1280px - 1535px (desktop)
 * - '2xl': 1536px+ (large desktop)
 */
export type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

interface TasksLayoutProps {
  kanban: ReactNode;
  attempt: ReactNode;
  aux: ReactNode;
  isPanelOpen: boolean;
  mode: LayoutMode;
  isMobile?: boolean;
  /** Current responsive breakpoint for fine-grained layout control */
  breakpoint?: Breakpoint;
  rightHeader?: ReactNode;
  /** Callback when mobile bottom sheet is dismissed */
  onClose?: () => void;
}

type SplitSizes = [number, number];

const MIN_PANEL_SIZE = 20;

// Default panel sizes vary by breakpoint for optimal viewing
const PANEL_SIZES: Record<
  Breakpoint,
  { kanbanAttempt: SplitSizes; attemptAux: SplitSizes }
> = {
  sm: { kanbanAttempt: [100, 0], attemptAux: [40, 60] }, // Mobile: full width kanban
  md: { kanbanAttempt: [55, 45], attemptAux: [40, 60] }, // Tablet: more balanced
  lg: { kanbanAttempt: [60, 40], attemptAux: [35, 65] }, // Small laptop
  xl: { kanbanAttempt: [66, 34], attemptAux: [34, 66] }, // Desktop (original)
  "2xl": { kanbanAttempt: [70, 30], attemptAux: [30, 70] }, // Large desktop: more kanban space
};

const DEFAULT_ATTEMPT_AUX: SplitSizes = [34, 66];

/** Mobile bottom sheet snap points: 30%, 60%, 90% of viewport height */
const MOBILE_SNAP_POINTS = [0.3, 0.6, 0.9];

const STORAGE_KEYS = {
  KANBAN_ATTEMPT: "tasksLayout.desktop.v2.kanbanAttempt",
  ATTEMPT_AUX: "tasksLayout.desktop.v2.attemptAux",
} as const;

function loadSizes(key: string, fallback: SplitSizes): SplitSizes {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length === 2)
      return parsed as SplitSizes;
    return fallback;
  } catch {
    return fallback;
  }
}

function saveSizes(key: string, sizes: SplitSizes): void {
  try {
    localStorage.setItem(key, JSON.stringify(sizes));
  } catch {
    // Ignore errors
  }
}

/**
 * AuxRouter - Handles nested AnimatePresence for preview/diffs transitions.
 */
function AuxRouter({ mode, aux }: { mode: LayoutMode; aux: ReactNode }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {mode && (
        <motion.div
          animate={{ opacity: 1 }}
          className="h-full min-h-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={mode}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        >
          {aux}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * RightWorkArea - Contains header and Attempt/Aux content.
 * Shows just Attempt when mode === null, or Attempt | Aux split when mode !== null.
 */
function RightWorkArea({
  attempt,
  aux,
  mode,
  rightHeader,
}: {
  attempt: ReactNode;
  aux: ReactNode;
  mode: LayoutMode;
  rightHeader?: ReactNode;
}) {
  const [innerSizes] = useState<SplitSizes>(() =>
    loadSizes(STORAGE_KEYS.ATTEMPT_AUX, DEFAULT_ATTEMPT_AUX)
  );
  const [isAttemptCollapsed, setIsAttemptCollapsed] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {rightHeader && (
        <div className="sticky top-0 z-20 shrink-0 border-b bg-background">
          {rightHeader}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {mode === null ? (
          attempt
        ) : (
          <PanelGroup
            className="h-full min-h-0"
            direction="horizontal"
            onLayout={(layout) => {
              if (layout.length === 2) {
                saveSizes(STORAGE_KEYS.ATTEMPT_AUX, [layout[0], layout[1]]);
              }
            }}
          >
            <Panel
              aria-label="Details"
              className="min-h-0 min-w-0 overflow-hidden"
              collapsedSize={0}
              collapsible
              defaultSize={innerSizes[0]}
              id="attempt"
              minSize={MIN_PANEL_SIZE}
              onCollapse={() => setIsAttemptCollapsed(true)}
              onExpand={() => setIsAttemptCollapsed(false)}
              order={1}
              role="region"
            >
              {attempt}
            </Panel>

            <PanelResizeHandle
              aria-label="Resize panels"
              aria-orientation="vertical"
              className={cn(
                "group relative z-30 cursor-col-resize touch-none bg-border",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                "focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                "transition-all",
                isAttemptCollapsed ? "w-6" : "w-1"
              )}
              id="handle-aa"
              role="separator"
            >
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
              <div className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-full border border-border bg-muted/90 px-1.5 py-3 opacity-70 shadow-sm transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              </div>
            </PanelResizeHandle>

            <Panel
              aria-label={mode === "preview" ? "Preview" : "Diffs"}
              className="min-h-0 min-w-0 overflow-hidden"
              collapsible={false}
              defaultSize={innerSizes[1]}
              id="aux"
              minSize={MIN_PANEL_SIZE}
              order={2}
              role="region"
            >
              <AuxRouter aux={aux} mode={mode} />
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  );
}

/**
 * MobileLayout - Uses BottomSheet for task detail panel on mobile devices.
 * Kanban is always visible in the background, detail panel slides up from bottom.
 */
function MobileLayout({
  kanban,
  attempt,
  aux,
  mode,
  isPanelOpen,
  rightHeader,
  onClose,
}: {
  kanban: ReactNode;
  attempt: ReactNode;
  aux: ReactNode;
  mode: LayoutMode;
  isPanelOpen: boolean;
  rightHeader?: ReactNode;
  onClose?: () => void;
}) {
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && onClose) {
        onClose();
      }
    },
    [onClose]
  );

  // Determine content based on mode
  const showAux = mode !== null;

  return (
    <div className="relative h-full min-h-0">
      {/* Kanban always visible in background */}
      <div className="h-full min-h-0">{kanban}</div>

      {/* Bottom sheet for task details */}
      <BottomSheet
        className="bg-background"
        defaultSnapPoint={1}
        dismissible
        onOpenChange={handleOpenChange} // Start at 60%
        open={isPanelOpen}
        snapPoints={MOBILE_SNAP_POINTS}
      >
        <div className="flex h-full min-h-0 flex-col">
          {/* Header */}
          {rightHeader && (
            <div className="shrink-0 border-b bg-background">{rightHeader}</div>
          )}

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {showAux ? <AuxRouter aux={aux} mode={mode} /> : attempt}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

/**
 * DesktopSimple - Conditionally renders layout based on mode.
 * When mode === null: Shows Kanban | Attempt
 * When mode !== null: Hides Kanban, shows only RightWorkArea with Attempt | Aux
 */
function DesktopSimple({
  kanban,
  attempt,
  aux,
  mode,
  breakpoint,
  rightHeader,
}: {
  kanban: ReactNode;
  attempt: ReactNode;
  aux: ReactNode;
  mode: LayoutMode;
  breakpoint: Breakpoint;
  rightHeader?: ReactNode;
}) {
  // Use breakpoint-specific defaults, falling back to stored sizes if available
  const breakpointDefaults = PANEL_SIZES[breakpoint];
  const [outerSizes] = useState<SplitSizes>(() =>
    loadSizes(STORAGE_KEYS.KANBAN_ATTEMPT, breakpointDefaults.kanbanAttempt)
  );
  const [isKanbanCollapsed, setIsKanbanCollapsed] = useState(false);

  // When preview/diffs is open, hide Kanban entirely and render only RightWorkArea
  if (mode !== null) {
    return (
      <RightWorkArea
        attempt={attempt}
        aux={aux}
        mode={mode}
        rightHeader={rightHeader}
      />
    );
  }

  // When only viewing attempt logs, show Kanban | Attempt (no aux)
  return (
    <PanelGroup
      className="h-full min-h-0"
      direction="horizontal"
      onLayout={(layout) => {
        if (layout.length === 2) {
          saveSizes(STORAGE_KEYS.KANBAN_ATTEMPT, [layout[0], layout[1]]);
        }
      }}
    >
      <Panel
        aria-label="Kanban board"
        className="min-h-0 min-w-0 overflow-hidden"
        collapsedSize={0}
        collapsible
        defaultSize={outerSizes[0]}
        id="kanban"
        minSize={MIN_PANEL_SIZE}
        onCollapse={() => setIsKanbanCollapsed(true)}
        onExpand={() => setIsKanbanCollapsed(false)}
        order={1}
        role="region"
      >
        {kanban}
      </Panel>

      <PanelResizeHandle
        aria-label="Resize panels"
        aria-orientation="vertical"
        className={cn(
          "group relative z-30 cursor-col-resize touch-none bg-border",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          "focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "transition-all",
          isKanbanCollapsed ? "w-6" : "w-1"
        )}
        id="handle-kr"
        role="separator"
      >
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-full border border-border bg-muted/90 px-1.5 py-3 opacity-70 shadow-sm transition-opacity group-hover:opacity-100 group-focus:opacity-100">
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
        </div>
      </PanelResizeHandle>

      <Panel
        className="min-h-0 min-w-0 overflow-hidden"
        collapsible={false}
        defaultSize={outerSizes[1]}
        id="right"
        minSize={MIN_PANEL_SIZE}
        order={2}
      >
        <RightWorkArea
          attempt={attempt}
          aux={aux}
          mode={mode}
          rightHeader={rightHeader}
        />
      </Panel>
    </PanelGroup>
  );
}

export function TasksLayout({
  kanban,
  attempt,
  aux,
  isPanelOpen,
  mode,
  isMobile = false,
  breakpoint = "xl",
  rightHeader,
  onClose,
}: TasksLayoutProps) {
  const desktopKey = isPanelOpen ? "desktop-with-panel" : "kanban-only";

  // Determine if we should use mobile (stacked) or desktop (panel) layout
  // Mobile layout: sm breakpoint or explicit isMobile flag
  // Tablet layout (md): Use panels but with adjusted sizing
  const useMobileLayout = isMobile || breakpoint === "sm";

  if (useMobileLayout) {
    // Use BottomSheet for mobile layout
    return (
      <MobileLayout
        attempt={attempt}
        aux={aux}
        isPanelOpen={isPanelOpen}
        kanban={kanban}
        mode={mode}
        onClose={onClose}
        rightHeader={rightHeader}
      />
    );
  }

  let desktopNode: ReactNode;

  if (isPanelOpen) {
    desktopNode = (
      <DesktopSimple
        attempt={attempt}
        aux={aux}
        breakpoint={breakpoint}
        kanban={kanban}
        mode={mode}
        rightHeader={rightHeader}
      />
    );
  } else {
    desktopNode = (
      <div
        aria-label="Kanban board"
        className="h-full min-h-0 min-w-0 overflow-hidden"
        role="region"
      >
        {kanban}
      </div>
    );
  }

  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        animate={{ opacity: 1 }}
        className="h-full min-h-0"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        key={desktopKey}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
      >
        {desktopNode}
      </motion.div>
    </AnimatePresence>
  );
}
