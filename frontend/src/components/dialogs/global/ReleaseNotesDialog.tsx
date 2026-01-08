import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { AlertCircle, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { APP_NAME, RELEASE_NOTES_URL } from "@/constants/branding";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { defineModal, type NoProps } from "@/lib/modals";
import { getActualTheme } from "@/utils/theme";

const ReleaseNotesDialogImpl = NiceModal.create<NoProps>(() => {
  const modal = useModal();
  const [iframeError, setIframeError] = useState(false);
  const { theme } = useTheme();

  const releaseNotesUrl = useMemo(() => {
    const actualTheme = getActualTheme(theme);
    const url = new URL(RELEASE_NOTES_URL);
    url.searchParams.set("theme", actualTheme);
    return url.toString();
  }, [theme]);

  const handleOpenInBrowser = () => {
    window.open(releaseNotesUrl, "_blank");
    modal.resolve();
  };

  const handleIframeError = () => {
    setIframeError(true);
  };

  return (
    <Dialog
      className="h-[calc(100%-4rem)]"
      onOpenChange={(open) => !open && modal.resolve()}
      open={modal.visible}
    >
      <DialogContent className="flex h-full max-h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col p-0">
        <DialogHeader className="flex-shrink-0 border-b p-4">
          <DialogTitle className="font-semibold text-xl">
            We've updated {APP_NAME}! Check out what's new...
          </DialogTitle>
        </DialogHeader>

        {iframeError ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-4 p-4 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="font-medium text-lg">
                Unable to load release notes
              </h3>
              <p className="max-w-md text-muted-foreground text-sm">
                We couldn't display the release notes in this window. Click
                below to view them in your browser.
              </p>
            </div>
            <Button className="mt-4" onClick={handleOpenInBrowser}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Release Notes in Browser
            </Button>
          </div>
        ) : (
          <iframe
            className="w-full flex-1 border-0"
            onError={handleIframeError}
            onLoad={(e) => {
              // Check if iframe content loaded successfully
              try {
                const iframe = e.target as HTMLIFrameElement;
                // If iframe is accessible but empty, it might indicate loading issues
                if (iframe.contentDocument?.body?.children.length === 0) {
                  setTimeout(() => setIframeError(true), 5000); // Wait 5s then show fallback
                }
              } catch {
                // Cross-origin access blocked (expected), iframe loaded successfully
              }
            }}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups"
            src={releaseNotesUrl}
            title="Release Notes"
          />
        )}

        <DialogFooter className="flex-shrink-0 border-t p-4">
          <Button onClick={handleOpenInBrowser} variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in Browser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export const ReleaseNotesDialog = defineModal<void, void>(
  ReleaseNotesDialogImpl
);
