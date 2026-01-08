import { generateDiffFile } from "@git-diff-view/file";
import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import { useMemo } from "react";
import "@/styles/diff-style-overrides.css";
import "@/styles/edit-diff-overrides.css";

type Props = {
  content: string;
  lang: string | null;
  theme?: "light" | "dark";
};

/**
 * View syntax highlighted file content.
 */
function FileContentView({ content, lang, theme }: Props) {
  // Uses the syntax highlighter from @git-diff-view/react without any diff-related features.
  // This allows uniform styling with EditDiffRenderer.
  const diffFile = useMemo(() => {
    try {
      const instance = generateDiffFile(
        "", // old file
        "", // old content (empty)
        "", // new file
        content, // new content
        "", // old lang
        lang || "plaintext" // new lang
      );
      instance.initRaw();
      return instance;
    } catch {
      return null;
    }
  }, [content, lang]);

  return diffFile ? (
    <div className="mt-2 border">
      <DiffView
        diffFile={diffFile}
        diffViewFontSize={12}
        diffViewHighlight
        diffViewMode={DiffModeEnum.Unified}
        diffViewTheme={theme}
        diffViewWrap={false}
      />
    </div>
  ) : (
    <pre className="overflow-x-auto whitespace-pre font-mono text-xs">
      {content}
    </pre>
  );
}

export default FileContentView;
