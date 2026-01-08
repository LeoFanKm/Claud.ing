import {
  AnimatePresence,
  motion,
  type PanInfo,
  useAnimation,
  useMotionValue,
} from "framer-motion";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Array of snap points as viewport height percentages (0-1). Default: [0.4, 0.9] */
  snapPoints?: number[];
  /** Index of the default snap point. Default: 0 */
  defaultSnapPoint?: number;
  /** Callback when snap point changes */
  onSnapPointChange?: (index: number) => void;
  className?: string;
  handleClassName?: string;
  overlayClassName?: string;
  /** Whether the sheet can be dismissed by dragging down. Default: true */
  dismissible?: boolean;
}

const DEFAULT_SNAP_POINTS = [0.4, 0.9];

export const BottomSheet = React.forwardRef<HTMLDivElement, BottomSheetProps>(
  (
    {
      open,
      onOpenChange,
      children,
      snapPoints = DEFAULT_SNAP_POINTS,
      defaultSnapPoint = 0,
      onSnapPointChange,
      className,
      handleClassName,
      overlayClassName,
      dismissible = true,
    },
    ref
  ) => {
    const [currentSnapIndex, setCurrentSnapIndex] =
      React.useState(defaultSnapPoint);
    const [viewportHeight, setViewportHeight] = React.useState(
      typeof window !== "undefined" ? window.innerHeight : 800
    );
    const controls = useAnimation();
    const y = useMotionValue(viewportHeight);
    const [overlayOpacity, setOverlayOpacity] = React.useState(0);

    // Update viewport height on resize
    React.useEffect(() => {
      const updateHeight = () => setViewportHeight(window.innerHeight);
      updateHeight();
      window.addEventListener("resize", updateHeight);
      return () => window.removeEventListener("resize", updateHeight);
    }, []);

    // Get Y position for a snap point (from top of screen)
    const getYForSnapPoint = React.useCallback(
      (snapPointIndex: number) => {
        const snapPoint = snapPoints[snapPointIndex];
        const sheetHeight = viewportHeight * snapPoint;
        return viewportHeight - sheetHeight;
      },
      [snapPoints, viewportHeight]
    );

    // Update overlay opacity based on y position
    React.useEffect(() => {
      const unsubscribe = y.on("change", (latest) => {
        const maxY = viewportHeight;
        const minY = getYForSnapPoint(snapPoints.length - 1);
        const progress = 1 - (latest - minY) / (maxY - minY);
        setOverlayOpacity(Math.max(0, Math.min(0.5, progress * 0.5)));
      });
      return unsubscribe;
    }, [y, viewportHeight, getYForSnapPoint, snapPoints.length]);

    // Animate to a specific snap point
    const snapTo = React.useCallback(
      async (index: number) => {
        const targetY = getYForSnapPoint(index);
        await controls.start({
          y: targetY,
          transition: {
            type: "spring",
            damping: 30,
            stiffness: 400,
          },
        });
        setCurrentSnapIndex(index);
        onSnapPointChange?.(index);
      },
      [controls, getYForSnapPoint, onSnapPointChange]
    );

    // Close the sheet
    const close = React.useCallback(async () => {
      await controls.start({
        y: viewportHeight,
        transition: {
          type: "spring",
          damping: 30,
          stiffness: 400,
        },
      });
      onOpenChange(false);
    }, [controls, onOpenChange, viewportHeight]);

    // Handle drag end - snap to nearest point or close
    const handleDragEnd = React.useCallback(
      (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const currentY = y.get();
        const velocity = info.velocity.y;
        const threshold = 50;

        // If dragging down with velocity, close or go to lower snap point
        if (velocity > 500 && dismissible) {
          if (currentSnapIndex === 0) {
            close();
          } else {
            snapTo(currentSnapIndex - 1);
          }
          return;
        }

        // If dragging up with velocity, go to higher snap point
        if (velocity < -500) {
          if (currentSnapIndex < snapPoints.length - 1) {
            snapTo(currentSnapIndex + 1);
          }
          return;
        }

        // Find nearest snap point
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        snapPoints.forEach((_, index) => {
          const snapY = getYForSnapPoint(index);
          const distance = Math.abs(currentY - snapY);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });

        // Check if should close (dragged below lowest snap point)
        const lowestSnapY = getYForSnapPoint(0);
        if (currentY > lowestSnapY + threshold && dismissible) {
          close();
          return;
        }

        snapTo(nearestIndex);
      },
      [
        y,
        currentSnapIndex,
        snapPoints,
        getYForSnapPoint,
        snapTo,
        close,
        dismissible,
      ]
    );

    // Initialize position when opening
    React.useEffect(() => {
      if (open) {
        const initialY = getYForSnapPoint(defaultSnapPoint);
        controls.set({ y: viewportHeight });
        controls.start({
          y: initialY,
          transition: {
            type: "spring",
            damping: 30,
            stiffness: 400,
          },
        });
        setCurrentSnapIndex(defaultSnapPoint);
      }
    }, [open, defaultSnapPoint, controls, getYForSnapPoint, viewportHeight]);

    // Handle viewport resize while open
    React.useEffect(() => {
      if (open) {
        const targetY = getYForSnapPoint(currentSnapIndex);
        controls.set({ y: targetY });
      }
    }, [viewportHeight, open, currentSnapIndex, controls, getYForSnapPoint]);

    // Lock body scroll when open
    React.useEffect(() => {
      if (open) {
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = "";
        };
      }
    }, [open]);

    const maxSheetHeight = snapPoints[snapPoints.length - 1] * 100;

    return (
      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              className={cn(
                "fixed inset-0 z-[9998] touch-none bg-black",
                overlayClassName
              )}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => dismissible && close()}
              style={{ opacity: overlayOpacity }}
            />

            {/* Sheet */}
            <motion.div
              animate={controls}
              className={cn(
                "fixed inset-x-0 bottom-0 z-[9999] flex flex-col rounded-t-2xl bg-primary shadow-lg",
                "will-change-transform",
                className
              )}
              drag="y"
              dragConstraints={{
                top: getYForSnapPoint(snapPoints.length - 1),
                bottom: viewportHeight,
              }}
              dragElastic={0.1}
              exit={{ y: viewportHeight }}
              initial={{ y: viewportHeight }}
              onDragEnd={handleDragEnd}
              ref={ref}
              style={{
                y,
                height: `${maxSheetHeight}vh`,
                touchAction: "none",
              }}
            >
              {/* Drag Handle */}
              <div
                className={cn(
                  "flex shrink-0 cursor-grab justify-center py-3 active:cursor-grabbing",
                  handleClassName
                )}
              >
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-safe">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }
);
BottomSheet.displayName = "BottomSheet";

// Helper components for content structure
export const BottomSheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
BottomSheetHeader.displayName = "BottomSheetHeader";

export const BottomSheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    className={cn(
      "font-semibold text-lg leading-none tracking-tight",
      className
    )}
    ref={ref}
    {...props}
  />
));
BottomSheetTitle.displayName = "BottomSheetTitle";

export const BottomSheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    className={cn("text-muted-foreground text-sm", className)}
    ref={ref}
    {...props}
  />
));
BottomSheetDescription.displayName = "BottomSheetDescription";

export const BottomSheetContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn("flex flex-col gap-4 py-4", className)}
    ref={ref}
    {...props}
  />
));
BottomSheetContent.displayName = "BottomSheetContent";

export const BottomSheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 pb-4 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
);
BottomSheetFooter.displayName = "BottomSheetFooter";
