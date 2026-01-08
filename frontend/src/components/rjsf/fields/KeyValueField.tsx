import type { FieldProps } from "@rjsf/utils";
import { Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type KeyValueData = Record<string, string>;

interface EnvFormContext {
  onEnvChange?: (envData: KeyValueData | undefined) => void;
}

export function KeyValueField({
  formData,
  disabled,
  readonly,
  registry,
}: FieldProps<KeyValueData>) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  // Get the custom env change handler from formContext
  const formContext = registry.formContext as EnvFormContext | undefined;

  // Ensure we have a stable object reference
  const data: KeyValueData = useMemo(() => formData ?? {}, [formData]);
  const entries = useMemo(() => Object.entries(data), [data]);

  // Use the formContext handler to update env correctly
  const updateValue = useCallback(
    (newData: KeyValueData | undefined) => {
      formContext?.onEnvChange?.(newData);
    },
    [formContext]
  );

  const handleAdd = useCallback(() => {
    const trimmedKey = newKey.trim();
    if (trimmedKey) {
      updateValue({
        ...data,
        [trimmedKey]: newValue,
      });
      setNewKey("");
      setNewValue("");
    }
  }, [data, newKey, newValue, updateValue]);

  const handleRemove = useCallback(
    (key: string) => {
      const updated = { ...data };
      delete updated[key];
      updateValue(Object.keys(updated).length > 0 ? updated : undefined);
    },
    [data, updateValue]
  );

  const handleValueChange = useCallback(
    (key: string, value: string) => {
      updateValue({ ...data, [key]: value });
    },
    [data, updateValue]
  );

  const isDisabled = disabled || readonly;

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div className="flex items-center gap-2" key={key}>
          <Input
            aria-label="Environment variable key"
            className="flex-1 font-mono text-sm"
            disabled
            value={key}
          />
          <Input
            aria-label={`Value for ${key}`}
            className="flex-1 font-mono text-sm"
            disabled={isDisabled}
            onChange={(e) => handleValueChange(key, e.target.value)}
            placeholder="Value"
            value={value ?? ""}
          />
          <Button
            aria-label={`Remove ${key}`}
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            disabled={isDisabled}
            onClick={() => handleRemove(key)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Add new entry row */}
      <div className="flex items-center gap-2">
        <Input
          aria-label="New environment variable key"
          className="flex-1 font-mono text-sm"
          disabled={isDisabled}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="KEY"
          value={newKey}
        />
        <Input
          aria-label="New environment variable value"
          className="flex-1 font-mono text-sm"
          disabled={isDisabled}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="value"
          value={newValue}
        />
        <Button
          aria-label="Add environment variable"
          className="h-8 w-8 shrink-0 p-0"
          disabled={isDisabled || !newKey.trim()}
          onClick={handleAdd}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
