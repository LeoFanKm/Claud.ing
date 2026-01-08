import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_NORMAL,
  KEY_ENTER_COMMAND,
  KEY_MODIFIER_COMMAND,
} from "lexical";
import { useEffect } from "react";

type Props = {
  onCmdEnter?: () => void;
  onShiftCmdEnter?: () => void;
};

export function KeyboardCommandsPlugin({ onCmdEnter, onShiftCmdEnter }: Props) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!(onCmdEnter || onShiftCmdEnter)) return;

    // Handle the modifier command to trigger the callbacks
    const unregisterModifier = editor.registerCommand(
      KEY_MODIFIER_COMMAND,
      (event: KeyboardEvent) => {
        if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
          return false;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.shiftKey && onShiftCmdEnter) {
          onShiftCmdEnter();
          return true;
        }

        if (!event.shiftKey && onCmdEnter) {
          onCmdEnter();
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_NORMAL
    );

    // Block KEY_ENTER_COMMAND when CMD/Ctrl is pressed to prevent
    // RichTextPlugin from inserting a new line
    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event && (event.metaKey || event.ctrlKey)) {
          return true; // Mark as handled, preventing line break insertion
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );

    return () => {
      unregisterModifier();
      unregisterEnter();
    };
  }, [editor, onCmdEnter, onShiftCmdEnter]);

  return null;
}
