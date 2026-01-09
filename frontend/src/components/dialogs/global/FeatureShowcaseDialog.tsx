import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShowcaseStageMedia } from "@/components/showcase/ShowcaseStageMedia";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { defineModal } from "@/lib/modals";
import type { ShowcaseConfig } from "@/types/showcase";

interface FeatureShowcaseDialogProps {
  config: ShowcaseConfig;
}

/**
 * FeatureShowcaseDialog - Generic multi-stage modal for showcasing features with media
 *
 * Displays a modal with stages containing videos or images, title, description,
 * and navigation controls. ESC key is disabled; only Next/Finish buttons dismiss.
 *
 * Features:
 * - Multi-stage or single-stage support (hides navigation if 1 stage)
 * - Video support with loading states and progress bars
 * - Image support with loading skeleton
 * - Responsive design (full-width on mobile, 2/3 width on desktop)
 * - i18n support via translation keys
 * - Smooth transitions between stages
 *
 * Usage:
 * ```ts
 * FeatureShowcaseDialog.show({ config: showcases.taskPanel });
 * ```
 */
const FeatureShowcaseDialogImpl = NiceModal.create<FeatureShowcaseDialogProps>(
  ({ config }: FeatureShowcaseDialogProps) => {
    const modal = useModal();
    const [currentStage, setCurrentStage] = useState(0);
    const { t } = useTranslation("tasks");

    const stage = config.stages[currentStage];
    const totalStages = config.stages.length;

    const handleNext = () => {
      setCurrentStage((prev) => {
        if (prev >= totalStages - 1) {
          modal.resolve();
          return prev;
        }
        return prev + 1;
      });
    };

    const handlePrevious = () => {
      setCurrentStage((prev) => Math.max(prev - 1, 0));
    };

    const handleClose = () => {
      modal.hide();
      modal.resolve();
      modal.remove();
    };

    return (
      <Dialog
        className="max-w-none overflow-hidden p-0 xl:max-w-[min(66.66vw,calc((100svh-20rem)*1.6))]"
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          }
        }}
        open={modal.visible}
        uncloseable
      >
        <DialogContent className="gap-0 p-0">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              initial={{ opacity: 0, x: 20 }}
              key={currentStage}
              transition={{ duration: 0.2 }}
            >
              <ShowcaseStageMedia media={stage.media} />

              <div className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-lg">
                      {t(stage.titleKey)}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 font-medium text-muted-foreground text-xs">
                    {currentStage + 1} / {totalStages}
                  </div>
                </div>

                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(stage.descriptionKey)}
                </p>

                <div className="flex items-center gap-2">
                  {Array.from({ length: totalStages }).map((_, index) => (
                    <div
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        index === currentStage ? "bg-foreground" : "bg-muted"
                      }`}
                      key={index}
                    />
                  ))}
                </div>

                {totalStages > 1 && (
                  <div className="flex justify-end gap-2 pt-2">
                    {currentStage > 0 && (
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 border border-input px-4 py-2 font-medium text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        onClick={handlePrevious}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {t("showcases.buttons.previous")}
                      </button>
                    )}
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 border border-foreground px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                      onClick={handleNext}
                    >
                      {currentStage === totalStages - 1
                        ? t("showcases.buttons.finish")
                        : t("showcases.buttons.next")}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    );
  }
);

export const FeatureShowcaseDialog = defineModal<
  FeatureShowcaseDialogProps,
  void
>(FeatureShowcaseDialogImpl);
