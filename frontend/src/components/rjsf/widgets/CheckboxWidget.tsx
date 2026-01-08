import type { WidgetProps } from "@rjsf/utils";
import { Checkbox } from "@/components/ui/checkbox";

export const CheckboxWidget = (props: WidgetProps) => {
  const { id, value, disabled, readonly, onChange } = props;

  const handleChange = (checked: boolean) => {
    onChange(checked);
  };

  const checked = Boolean(value);

  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        checked={checked}
        disabled={disabled || readonly}
        id={id}
        onCheckedChange={handleChange}
      />
    </div>
  );
};
