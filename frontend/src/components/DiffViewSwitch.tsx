import { Columns, FileText, Pilcrow, WrapText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useDiffViewMode,
  useDiffViewStore,
  useIgnoreWhitespaceDiff,
  useWrapTextDiff,
} from "@/stores/useDiffViewStore";

type Props = {
  className?: string;
};

export default function DiffViewSwitch({ className }: Props) {
  const { t } = useTranslation("tasks");
  const mode = useDiffViewMode();
  const setMode = useDiffViewStore((s) => s.setMode);
  const ignoreWhitespace = useIgnoreWhitespaceDiff();
  const setIgnoreWhitespace = useDiffViewStore((s) => s.setIgnoreWhitespace);
  const wrapText = useWrapTextDiff();
  const setWrapText = useDiffViewStore((s) => s.setWrapText);

  const whitespaceValue = ignoreWhitespace ? ["ignoreWhitespace"] : [];
  const wrapTextValue = wrapText ? ["wrapText"] : [];

  return (
    <TooltipProvider>
      <div className={cn("inline-flex gap-4", className)}>
        <ToggleGroup
          aria-label="Diff view mode"
          className="inline-flex gap-4"
          onValueChange={(v) => v && setMode(v as "unified" | "split")}
          type="single"
          value={mode ?? ""}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                active={mode === "unified"}
                aria-label="Inline view"
                value="unified"
              >
                <FileText className="h-4 w-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("diff.viewModes.inline")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                active={mode === "split"}
                aria-label="Split view"
                value="split"
              >
                <Columns className="h-4 w-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("diff.viewModes.split")}
            </TooltipContent>
          </Tooltip>
        </ToggleGroup>

        <ToggleGroup
          aria-label={t("diff.ignoreWhitespace")}
          className="inline-flex gap-4"
          onValueChange={(values) =>
            setIgnoreWhitespace(values.includes("ignoreWhitespace"))
          }
          type="multiple"
          value={whitespaceValue}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                active={ignoreWhitespace}
                aria-label={t("diff.ignoreWhitespace")}
                value="ignoreWhitespace"
              >
                <Pilcrow className="h-4 w-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("diff.ignoreWhitespace")}
            </TooltipContent>
          </Tooltip>
        </ToggleGroup>

        <ToggleGroup
          aria-label={t("diff.wrapText", "Wrap text")}
          className="inline-flex gap-4"
          onValueChange={(values) => setWrapText(values.includes("wrapText"))}
          type="multiple"
          value={wrapTextValue}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                active={wrapText}
                aria-label={t("diff.wrapText", "Wrap text")}
                value="wrapText"
              >
                <WrapText className="h-4 w-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("diff.wrapText", "Wrap text")}
            </TooltipContent>
          </Tooltip>
        </ToggleGroup>
      </div>
    </TooltipProvider>
  );
}
