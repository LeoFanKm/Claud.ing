import { useMemo } from "react";
import { useUserSystem } from "@/components/ConfigProvider";
import { Button } from "@/components/ui/button";
import { getIdeName, IdeIcon } from "./IdeIcon";

type OpenInIdeButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export function OpenInIdeButton({
  onClick,
  disabled = false,
  className,
}: OpenInIdeButtonProps) {
  const { config } = useUserSystem();
  const editorType = config?.editor?.editor_type ?? null;

  const label = useMemo(() => {
    const ideName = getIdeName(editorType);
    return `Open in ${ideName}`;
  }, [editorType]);

  return (
    <Button
      aria-label={label}
      className={`h-10 w-10 p-0 transition-opacity hover:opacity-70 ${className ?? ""}`}
      disabled={disabled}
      onClick={onClick}
      size="sm"
      title={label}
      variant="ghost"
    >
      <IdeIcon className="h-4 w-4" editorType={editorType} />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
