import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export function DevBanner() {
  const { t } = useTranslation();

  // Only show in development mode
  if (import.meta.env.MODE !== "development") {
    return null;
  }

  return (
    <div className="border-orange-600 border-b bg-orange-500 px-4 py-2 text-center font-medium text-sm text-white">
      <div className="flex items-center justify-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>{t("devMode.banner")}</span>
      </div>
    </div>
  );
}
