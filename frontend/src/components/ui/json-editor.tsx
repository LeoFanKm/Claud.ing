import { json, jsonParseLinter } from "@codemirror/lang-json";
import { indentOnInput } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import type React from "react";
import { ThemeMode } from "shared/types";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

interface JSONEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
  className?: string;
  id?: string;
}

export const JSONEditor: React.FC<JSONEditorProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  minHeight = 300,
  className,
  id,
}) => {
  const { theme } = useTheme();

  // Convert app theme to CodeMirror theme
  const getCodeMirrorTheme = () => {
    if (theme === ThemeMode.SYSTEM) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme === ThemeMode.DARK ? "dark" : "light";
  };

  // Avoid SSR errors
  if (typeof window === "undefined") return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-input bg-background",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      id={id}
    >
      <CodeMirror
        basicSetup={{
          lineNumbers: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          searchKeymap: false,
        }}
        extensions={[
          json(),
          linter(jsonParseLinter()),
          indentOnInput(),
          EditorView.lineWrapping,
          disabled ? EditorView.editable.of(false) : [],
        ]}
        height={`${minHeight}px`}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          fontSize: "14px",
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        }}
        theme={getCodeMirrorTheme()}
        value={value}
      />
    </div>
  );
};
