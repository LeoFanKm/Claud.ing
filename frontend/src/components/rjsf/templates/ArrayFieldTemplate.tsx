import type {
  ArrayFieldItemTemplateProps,
  ArrayFieldTemplateProps,
} from "@rjsf/utils";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ArrayFieldTemplate = (props: ArrayFieldTemplateProps) => {
  const { canAdd, items, onAddClick, disabled, readonly } = props;

  if (!items || (items.length === 0 && !canAdd)) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>{items}</div>

      {canAdd && (
        <Button
          className="w-full"
          disabled={disabled || readonly}
          onClick={onAddClick}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      )}
    </div>
  );
};

export const ArrayFieldItemTemplate = (props: ArrayFieldItemTemplateProps) => {
  const { children, buttonsProps, disabled, readonly } = props;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">{children}</div>

      {/* Remove button */}
      {buttonsProps.hasRemove && (
        <Button
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled || readonly || buttonsProps.disabled}
          onClick={buttonsProps.onRemoveItem}
          size="sm"
          title="Remove item"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
