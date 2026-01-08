import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { defineModal } from "@/lib/modals";
import { formatFileSize } from "@/lib/utils";

export interface ImagePreviewDialogProps {
  imageUrl: string;
  altText: string;
  fileName?: string;
  format?: string;
  sizeBytes?: bigint | null;
}

const ImagePreviewDialogImpl = NiceModal.create<ImagePreviewDialogProps>(
  (props) => {
    const modal = useModal();
    const { imageUrl, altText, fileName, format, sizeBytes } = props;
    const [imageLoaded, setImageLoaded] = useState(false);

    const handleClose = () => {
      modal.hide();
    };

    // Build metadata string
    const metadataParts: string[] = [];
    if (format) {
      metadataParts.push(format.toUpperCase());
    }
    const sizeStr = formatFileSize(sizeBytes);
    if (sizeStr) {
      metadataParts.push(sizeStr);
    }
    const metadataLine = metadataParts.join(" · ");

    return (
      <Dialog onOpenChange={handleClose} open={modal.visible}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          {fileName && (
            <DialogHeader className="px-4 pt-4 pb-0">
              <DialogTitle className="truncate">{fileName}</DialogTitle>
            </DialogHeader>
          )}
          <div className="relative flex min-h-[200px] items-center justify-center">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <img
              alt={altText}
              className={`max-h-[70vh] max-w-full object-contain ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              src={imageUrl}
            />
          </div>
          {metadataLine && (
            <DialogFooter className="border-t px-4 py-3 sm:justify-start">
              <p className="text-muted-foreground text-xs">{metadataLine}</p>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

export const ImagePreviewDialog = defineModal<ImagePreviewDialogProps, void>(
  ImagePreviewDialogImpl
);
