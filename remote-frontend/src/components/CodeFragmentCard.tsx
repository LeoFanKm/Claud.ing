import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { useMemo, useState } from "react";
import type { CodeFragment } from "../types/review";

// Register languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);

// Aliases
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("py", python);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("rb", ruby);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("htm", xml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("kt", kotlin);

const extToLang: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  css: "css",
  json: "json",
  html: "xml",
  htm: "xml",
  xml: "xml",
  sh: "bash",
  bash: "bash",
  sql: "sql",
  yml: "yaml",
  yaml: "yaml",
  md: "markdown",
  cpp: "cpp",
  cc: "cpp",
  c: "cpp",
  h: "cpp",
  cs: "csharp",
  rb: "ruby",
  swift: "swift",
  kt: "kotlin",
};

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return extToLang[ext] || "plaintext";
}

type ViewMode = "fragment" | "file";

interface CodeFragmentCardProps {
  fragment: CodeFragment;
  fileContent?: string;
  isLoading?: boolean;
  unchangedRegion?: boolean;
  hideHeader?: boolean;
}

export function CodeFragmentCard({
  fragment,
  fileContent,
  isLoading,
  unchangedRegion,
  hideHeader,
}: CodeFragmentCardProps) {
  const { file, start_line, end_line, message } = fragment;
  const [viewMode, setViewMode] = useState<ViewMode>("fragment");
  const lang = getLanguageFromPath(file);

  const highlightedLines = useMemo(() => {
    if (!fileContent) return null;

    if (viewMode === "fragment") {
      return getHighlightedLines(fileContent, start_line, end_line, lang);
    }
    // Full file view
    const allLines = fileContent.split(/\r?\n/);
    return getHighlightedLines(fileContent, 1, allLines.length, lang);
  }, [fileContent, start_line, end_line, lang, viewMode]);

  const isInFragment = (lineNumber: number) =>
    lineNumber >= start_line && lineNumber <= end_line;

  return (
    <div
      className={hideHeader ? "" : "overflow-hidden rounded border bg-muted/40"}
    >
      {/* Header */}
      {!hideHeader && (
        <div className="border-b bg-muted/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
              <span className="truncate font-mono">{file}</span>
              <span className="shrink-0">
                Lines {start_line}
                {end_line !== start_line && `–${end_line}`}
              </span>
              {unchangedRegion && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Unchanged
                </span>
              )}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {fileContent && (
                <button
                  className="flex h-6 items-center justify-center rounded px-2 transition-colors hover:bg-muted"
                  onClick={() =>
                    setViewMode((prev) =>
                      prev === "fragment" ? "file" : "fragment"
                    )
                  }
                  title={
                    viewMode === "fragment"
                      ? "View full file"
                      : "View fragment only"
                  }
                >
                  {viewMode === "fragment" ? (
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
          {message && (
            <div className="mt-1.5 flex items-start gap-1.5 text-amber-600 text-xs italic dark:text-amber-400">
              <svg
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              <span>{message}</span>
            </div>
          )}
        </div>
      )}

      {/* Code Content */}
      {isLoading ? (
        <div className="flex items-center justify-center px-3 py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-muted-foreground/60 border-b-2" />
          <span className="ml-2 text-muted-foreground text-xs">Loading...</span>
        </div>
      ) : highlightedLines ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <tbody>
              {highlightedLines.map(({ lineNumber, html }) => (
                <tr
                  className={`leading-5 hover:bg-muted/50 ${
                    viewMode === "file" && isInFragment(lineNumber)
                      ? "bg-amber-500/10"
                      : ""
                  }`}
                  key={lineNumber}
                >
                  <td className="w-[1%] min-w-[40px] select-none border-r px-3 py-0 text-right align-top text-muted-foreground/60">
                    {lineNumber}
                  </td>
                  <td
                    className="whitespace-pre px-3 py-0"
                    dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-3 py-4 text-muted-foreground text-xs">
          File content unavailable for this fragment.
        </div>
      )}
    </div>
  );
}

function getHighlightedLines(
  content: string,
  startLine: number,
  endLine: number,
  lang: string
): { lineNumber: number; html: string }[] {
  const allLines = content.split(/\r?\n/);
  const s = Math.max(1, startLine);
  const e = Math.min(allLines.length, endLine);
  const result: { lineNumber: number; html: string }[] = [];

  for (let i = s; i <= e; i++) {
    const line = allLines[i - 1] || "";
    let html: string;

    try {
      if (lang !== "plaintext" && hljs.getLanguage(lang)) {
        html = hljs.highlight(line, {
          language: lang,
          ignoreIllegals: true,
        }).value;
      } else {
        html = escapeHtml(line);
      }
    } catch {
      html = escapeHtml(line);
    }

    result.push({ lineNumber: i, html });
  }

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
