import type { RegistryFieldsType, RegistryWidgetsType } from "@rjsf/utils";
import { KeyValueField } from "./fields";
import {
  ArrayFieldItemTemplate,
  ArrayFieldTemplate,
  FieldTemplate,
  FormTemplate,
  ObjectFieldTemplate,
} from "./templates";
import {
  CheckboxWidget,
  SelectWidget,
  TextareaWidget,
  TextWidget,
} from "./widgets";

export const customWidgets: RegistryWidgetsType = {
  TextWidget,
  SelectWidget,
  CheckboxWidget,
  TextareaWidget,
  textarea: TextareaWidget,
};

export const customTemplates = {
  ArrayFieldTemplate,
  ArrayFieldItemTemplate,
  FieldTemplate,
  ObjectFieldTemplate,
  FormTemplate,
};

export const customFields: RegistryFieldsType = {
  KeyValueField,
};

export const shadcnTheme = {
  widgets: customWidgets,
  templates: customTemplates,
  fields: customFields,
};
