import type { NodeKey, SerializedLexicalNode, Spread } from "lexical";
import { HelpCircle, Loader2 } from "lucide-react";
import { useCallback } from "react";
import { ImagePreviewDialog } from "@/components/dialogs/wysiwyg/ImagePreviewDialog";
import { useImageMetadata } from "@/hooks/useImageMetadata";
import { formatFileSize } from "@/lib/utils";
import {
  useLocalImages,
  useTaskAttemptId,
  useTaskId,
} from "../context/task-attempt-context";
import {
  createDecoratorNode,
  type DecoratorNodeConfig,
  type GeneratedDecoratorNode,
} from "../lib/create-decorator-node";

export interface ImageData {
  src: string;
  altText: string;
}

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
  },
  SerializedLexicalNode
>;

function truncatePath(path: string, maxLength = 24): string {
  const filename = path.split("/").pop() || path;
  if (filename.length <= maxLength) return filename;
  return filename.slice(0, maxLength - 3) + "...";
}

function ImageComponent({
  data,
  onDoubleClickEdit,
}: {
  data: ImageData;
  nodeKey: NodeKey;
  onDoubleClickEdit: (event: React.MouseEvent) => void;
}): JSX.Element {
  const { src, altText } = data;
  const taskAttemptId = useTaskAttemptId();
  const taskId = useTaskId();
  const localImages = useLocalImages();

  const isVibeImage = src.startsWith(".vibe-images/");

  // Use TanStack Query for caching metadata across component recreations
  // Pass both taskAttemptId and taskId - the hook prefers taskAttemptId when available
  // Also pass localImages for immediate rendering of newly uploaded images
  const { data: metadata, isLoading: loading } = useImageMetadata(
    taskAttemptId,
    src,
    taskId,
    localImages
  );

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // Open preview dialog if we have a valid image URL
      if (metadata?.exists && metadata.proxy_url) {
        ImagePreviewDialog.show({
          imageUrl: metadata.proxy_url,
          altText,
          fileName: metadata.file_name ?? undefined,
          format: metadata.format ?? undefined,
          sizeBytes: metadata.size_bytes,
        });
      }
    },
    [metadata, altText]
  );

  // Determine what to show as thumbnail
  let thumbnailContent: React.ReactNode;
  let displayName: string;
  let metadataLine: string | null = null;

  // Check if we have context for fetching metadata (either taskAttemptId or taskId)
  const hasContext = !!taskAttemptId || !!taskId;
  // Check if image exists in local images (for create mode where no task context exists yet)
  const hasLocalImage = localImages.some((img) => img.path === src);

  if (isVibeImage && (hasLocalImage || hasContext)) {
    if (loading) {
      thumbnailContent = (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
      displayName = truncatePath(src);
    } else if (metadata?.exists && metadata.proxy_url) {
      thumbnailContent = (
        <img
          alt={altText}
          className="h-10 w-10 flex-shrink-0 rounded object-cover"
          draggable={false}
          src={metadata.proxy_url}
        />
      );
      displayName = truncatePath(metadata.file_name || altText || src);
      // Build metadata line
      const parts: string[] = [];
      if (metadata.format) {
        parts.push(metadata.format.toUpperCase());
      }
      const sizeStr = formatFileSize(metadata.size_bytes);
      if (sizeStr) {
        parts.push(sizeStr);
      }
      if (parts.length > 0) {
        metadataLine = parts.join(" · ");
      }
    } else {
      // Vibe image but not found or error
      thumbnailContent = (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-muted">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
        </div>
      );
      displayName = truncatePath(src);
    }
  } else if (isVibeImage) {
    // isVibeImage but no context available - fallback to question mark
    thumbnailContent = (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-muted">
        <HelpCircle className="h-5 w-5 text-muted-foreground" />
      </div>
    );
    displayName = truncatePath(src);
  } else {
    // Non-vibe-image: show question mark and path
    thumbnailContent = (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-muted">
        <HelpCircle className="h-5 w-5 text-muted-foreground" />
      </div>
    );
    displayName = truncatePath(altText || src);
  }

  return (
    <span
      className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-border bg-muted px-1.5 py-1 align-bottom hover:border-muted-foreground"
      onClick={handleClick}
      onDoubleClick={onDoubleClickEdit}
      role="button"
      tabIndex={0}
    >
      {thumbnailContent}
      <span className="flex min-w-0 flex-col">
        <span className="max-w-[120px] truncate text-muted-foreground text-xs">
          {displayName}
        </span>
        {metadataLine && (
          <span className="max-w-[120px] truncate text-[10px] text-muted-foreground/70">
            {metadataLine}
          </span>
        )}
      </span>
    </span>
  );
}

const config: DecoratorNodeConfig<ImageData> = {
  type: "image",
  serialization: {
    format: "inline",
    pattern: /!\[([^\]]*)\]\(([^)]+)\)/,
    trigger: ")",
    serialize: (data) => `![${data.altText}](${data.src})`,
    deserialize: (match) => ({ src: match[2], altText: match[1] }),
  },
  component: ImageComponent,
  importDOM: (createNode) => ({
    img: () => ({
      conversion: (el: HTMLElement) => {
        const img = el as HTMLImageElement;
        return {
          node: createNode({
            src: img.getAttribute("src") || "",
            altText: img.getAttribute("alt") || "",
          }),
        };
      },
      priority: 0,
    }),
  }),
  exportDOM: (data) => {
    const img = document.createElement("img");
    img.setAttribute("src", data.src);
    img.setAttribute("alt", data.altText);
    return img;
  },
};

const result = createDecoratorNode(config);

export const ImageNode = result.Node;
export type ImageNodeInstance = GeneratedDecoratorNode<ImageData>;
export const $createImageNode = (src: string, altText: string) =>
  result.createNode({ src, altText });
export const $isImageNode = result.isNode;
export const IMAGE_TRANSFORMER = result.transformers[0];
