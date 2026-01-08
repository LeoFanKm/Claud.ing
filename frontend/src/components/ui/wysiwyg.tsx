import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { TRANSFORMERS, type Transformer } from "@lexical/markdown";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { EditorState } from "lexical";
import { Check, Clipboard, Pencil, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { writeClipboardViaBridge } from "@/vscode/bridge";
import {
  type LocalImageMetadata,
  LocalImagesContext,
  TaskAttemptContext,
  TaskContext,
} from "./wysiwyg/context/task-attempt-context";
import { CODE_HIGHLIGHT_CLASSES } from "./wysiwyg/lib/code-highlight-theme";
import {
  GITHUB_COMMENT_EXPORT_TRANSFORMER,
  GITHUB_COMMENT_TRANSFORMER,
  GitHubCommentNode,
} from "./wysiwyg/nodes/github-comment-node";
import { IMAGE_TRANSFORMER, ImageNode } from "./wysiwyg/nodes/image-node";
import { CodeBlockShortcutPlugin } from "./wysiwyg/plugins/code-block-shortcut-plugin";
import { CodeHighlightPlugin } from "./wysiwyg/plugins/code-highlight-plugin";
import { FileTagTypeaheadPlugin } from "./wysiwyg/plugins/file-tag-typeahead-plugin";
import { ImageKeyboardPlugin } from "./wysiwyg/plugins/image-keyboard-plugin";
import { KeyboardCommandsPlugin } from "./wysiwyg/plugins/keyboard-commands-plugin";
import { MarkdownSyncPlugin } from "./wysiwyg/plugins/markdown-sync-plugin";
import { ReadOnlyLinkPlugin } from "./wysiwyg/plugins/read-only-link-plugin";
import { ToolbarPlugin } from "./wysiwyg/plugins/toolbar-plugin";
import { CODE_BLOCK_TRANSFORMER } from "./wysiwyg/transformers/code-block-transformer";

/** Markdown string representing the editor content */
export type SerializedEditorState = string;

type WysiwygProps = {
  placeholder?: string;
  /** Markdown string representing the editor content */
  value: SerializedEditorState;
  onChange?: (state: SerializedEditorState) => void;
  onEditorStateChange?: (s: EditorState) => void;
  disabled?: boolean;
  onPasteFiles?: (files: File[]) => void;
  className?: string;
  projectId?: string; // for file search in typeahead
  onCmdEnter?: () => void;
  onShiftCmdEnter?: () => void;
  /** Task attempt ID for resolving .vibe-images paths (preferred over taskId) */
  taskAttemptId?: string;
  /** Task ID for resolving .vibe-images paths when taskAttemptId is not available */
  taskId?: string;
  /** Local images for immediate rendering (before saved to server) */
  localImages?: LocalImageMetadata[];
  /** Optional edit callback - shows edit button in read-only mode when provided */
  onEdit?: () => void;
  /** Optional delete callback - shows delete button in read-only mode when provided */
  onDelete?: () => void;
  /** Auto-focus the editor on mount */
  autoFocus?: boolean;
};

function WYSIWYGEditor({
  placeholder = "",
  value,
  onChange,
  onEditorStateChange,
  disabled = false,
  onPasteFiles,
  className,
  projectId,
  onCmdEnter,
  onShiftCmdEnter,
  taskAttemptId,
  taskId,
  localImages,
  onEdit,
  onDelete,
  autoFocus = false,
}: WysiwygProps) {
  // Copy button state
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    if (!value) return;
    try {
      await writeClipboardViaBridge(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 400);
    } catch {
      // noop – bridge handles fallback
    }
  }, [value]);

  const initialConfig = useMemo(
    () => ({
      namespace: "md-wysiwyg",
      onError: console.error,
      theme: {
        paragraph: "mb-2 last:mb-0",
        heading: {
          h1: "mt-4 mb-2 text-2xl font-semibold",
          h2: "mt-3 mb-2 text-xl font-semibold",
          h3: "mt-3 mb-2 text-lg font-semibold",
          h4: "mt-2 mb-1 text-base font-medium",
          h5: "mt-2 mb-1 text-sm font-medium",
          h6: "mt-2 mb-1 text-xs font-medium uppercase tracking-wide",
        },
        quote:
          "my-3 border-l-4 border-primary-foreground pl-4 text-muted-foreground",
        list: {
          ul: "my-1 list-disc list-inside",
          ol: "my-1 list-decimal list-inside",
          listitem: "",
          nested: {
            listitem: "pl-4",
          },
        },
        link: "text-blue-600 dark:text-blue-400 underline underline-offset-2 cursor-pointer hover:text-blue-800 dark:hover:text-blue-300",
        text: {
          bold: "font-semibold",
          italic: "italic",
          underline: "underline underline-offset-2",
          strikethrough: "line-through",
          code: "font-mono bg-muted px-1 py-0.5 rounded",
        },
        code: "block font-mono bg-secondary rounded-md px-3 py-2 my-2 whitespace-pre overflow-x-auto",
        codeHighlight: CODE_HIGHLIGHT_CLASSES,
      },
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        CodeNode,
        CodeHighlightNode,
        LinkNode,
        ImageNode,
        GitHubCommentNode,
      ],
    }),
    []
  );

  // Extended transformers with image, GitHub comment, and code block support (memoized to prevent unnecessary re-renders)
  const extendedTransformers: Transformer[] = useMemo(
    () => [
      IMAGE_TRANSFORMER,
      GITHUB_COMMENT_EXPORT_TRANSFORMER, // Export transformer for DecoratorNode (must be before import transformer)
      GITHUB_COMMENT_TRANSFORMER, // Import transformer for fenced code block
      CODE_BLOCK_TRANSFORMER,
      ...TRANSFORMERS,
    ],
    []
  );

  // Memoized handlers for ContentEditable to prevent re-renders
  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      if (!onPasteFiles || disabled) return;

      const dt = event.clipboardData;
      if (!dt) return;

      const files: File[] = Array.from(dt.files || []).filter((f) =>
        f.type.startsWith("image/")
      );

      if (files.length > 0) {
        onPasteFiles(files);
      }
    },
    [onPasteFiles, disabled]
  );

  // Memoized placeholder element
  const placeholderElement = useMemo(
    () =>
      disabled ? null : (
        <div className="pointer-events-none absolute top-0 left-0 text-secondary-foreground text-sm">
          {placeholder}
        </div>
      ),
    [disabled, placeholder]
  );

  const editorContent = (
    <div className="wysiwyg text-sm">
      <TaskAttemptContext.Provider value={taskAttemptId}>
        <TaskContext.Provider value={taskId}>
          <LocalImagesContext.Provider value={localImages ?? []}>
            <LexicalComposer initialConfig={initialConfig}>
              <MarkdownSyncPlugin
                editable={!disabled}
                onChange={onChange}
                onEditorStateChange={onEditorStateChange}
                transformers={extendedTransformers}
                value={value}
              />
              {!disabled && <ToolbarPlugin />}
              <div className="relative">
                <RichTextPlugin
                  contentEditable={
                    <ContentEditable
                      aria-label={
                        disabled ? "Markdown content" : "Markdown editor"
                      }
                      className={cn(
                        "outline-none",
                        !disabled && "min-h-[200px]",
                        className
                      )}
                      onPaste={handlePaste}
                    />
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                  placeholder={placeholderElement}
                />
              </div>

              <ListPlugin />
              <CodeHighlightPlugin />
              {/* Only include editing plugins when not in read-only mode */}
              {!disabled && (
                <>
                  {autoFocus && <AutoFocusPlugin />}
                  <HistoryPlugin />
                  <MarkdownShortcutPlugin transformers={extendedTransformers} />
                  <FileTagTypeaheadPlugin projectId={projectId} />
                  <KeyboardCommandsPlugin
                    onCmdEnter={onCmdEnter}
                    onShiftCmdEnter={onShiftCmdEnter}
                  />
                  <ImageKeyboardPlugin />
                  <CodeBlockShortcutPlugin />
                </>
              )}
              {/* Link sanitization for read-only mode */}
              {disabled && <ReadOnlyLinkPlugin />}
            </LexicalComposer>
          </LocalImagesContext.Provider>
        </TaskContext.Provider>
      </TaskAttemptContext.Provider>
    </div>
  );

  // Wrap with action buttons in read-only mode
  if (disabled) {
    return (
      <div className="group relative">
        <div className="pointer-events-none sticky top-0 right-2 z-10 h-0">
          <div className="flex justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {/* Copy button */}
            <Button
              aria-label={copied ? "Copied!" : "Copy as Markdown"}
              className="pointer-events-auto h-8 w-8 bg-muted p-2"
              onClick={handleCopy}
              size="icon"
              title={copied ? "Copied!" : "Copy as Markdown"}
              type="button"
              variant="icon"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Clipboard className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {/* Edit button - only if onEdit provided */}
            {onEdit && (
              <Button
                aria-label="Edit"
                className="pointer-events-auto h-8 w-8 bg-muted p-2"
                onClick={onEdit}
                size="icon"
                title="Edit"
                type="button"
                variant="icon"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            {/* Delete button - only if onDelete provided */}
            {onDelete && (
              <Button
                aria-label="Delete"
                className="pointer-events-auto h-8 w-8 bg-muted p-2"
                onClick={onDelete}
                size="icon"
                title="Delete"
                type="button"
                variant="icon"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
        {editorContent}
      </div>
    );
  }

  return editorContent;
}

export default memo(WYSIWYGEditor);
