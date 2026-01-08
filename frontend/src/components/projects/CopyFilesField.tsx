import { useTranslation } from "react-i18next";
import { MultiFileSearchTextarea } from "@/components/ui/multi-file-search-textarea";

interface CopyFilesFieldProps {
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  disabled?: boolean;
}

export function CopyFilesField({
  value,
  onChange,
  projectId,
  disabled = false,
}: CopyFilesFieldProps) {
  const { t } = useTranslation("projects");

  return (
    <MultiFileSearchTextarea
      className="resize-vertical w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      disabled={disabled}
      maxRows={6}
      onChange={onChange}
      placeholder={t("copyFilesPlaceholderWithSearch")}
      projectId={projectId}
      rows={3}
      value={value}
    />
  );
}
