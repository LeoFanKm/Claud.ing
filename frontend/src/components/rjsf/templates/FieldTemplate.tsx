import type { FieldTemplateProps } from "@rjsf/utils";

export const FieldTemplate = (props: FieldTemplateProps) => {
  const {
    children,
    rawErrors = [],
    rawHelp,
    rawDescription,
    label,
    required,
    schema,
  } = props;

  if (schema.type === "object") {
    return children;
  }

  // Two-column layout for other field types
  return (
    <div className="grid grid-cols-1 gap-4 py-6 md:grid-cols-2">
      {/* Left column: Label and description */}
      <div className="space-y-2">
        {label && (
          <div className="font-bold text-sm leading-relaxed">
            {label}
            {required && <span className="ml-1 text-destructive">*</span>}
          </div>
        )}

        {rawDescription && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {rawDescription}
          </p>
        )}

        {rawHelp && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {rawHelp}
          </p>
        )}
      </div>

      {/* Right column: Field content */}
      <div className="space-y-2">
        {children}

        {rawErrors.length > 0 && (
          <div className="space-y-1">
            {rawErrors.map((error, index) => (
              <p className="text-destructive text-sm" key={index}>
                {error}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
