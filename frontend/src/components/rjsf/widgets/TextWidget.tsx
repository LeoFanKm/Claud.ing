import type { WidgetProps } from "@rjsf/utils";
import { Input } from "@/components/ui/input";

export const TextWidget = (props: WidgetProps) => {
  const {
    id,
    value,
    disabled,
    readonly,
    onChange,
    onBlur,
    onFocus,
    placeholder,
    options,
  } = props;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(newValue === "" ? options.emptyValue : newValue);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (onBlur) {
      onBlur(id, event.target.value);
    }
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    if (onFocus) {
      onFocus(id, event.target.value);
    }
  };

  return (
    <Input
      disabled={disabled || readonly}
      id={id}
      onBlur={handleBlur}
      onChange={handleChange}
      onFocus={handleFocus}
      placeholder={placeholder || ""}
      value={value ?? ""}
    />
  );
};
