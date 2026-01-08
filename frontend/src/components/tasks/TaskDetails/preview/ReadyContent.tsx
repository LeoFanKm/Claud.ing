import { useTranslation } from "react-i18next";

interface ReadyContentProps {
  url?: string;
  iframeKey: string;
  onIframeError: () => void;
}

export function ReadyContent({
  url,
  iframeKey,
  onIframeError,
}: ReadyContentProps) {
  const { t } = useTranslation("tasks");

  return (
    <div className="flex-1">
      <iframe
        className="h-full w-full border-0"
        key={iframeKey}
        onError={onIframeError}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        src={url}
        title={t("preview.iframe.title")}
      />
    </div>
  );
}
