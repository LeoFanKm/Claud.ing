// Global app dialogs

// Auth dialogs
export { GhCliSetupDialog } from "./auth/GhCliSetupDialog";
export { DisclaimerDialog } from "./global/DisclaimerDialog";
export { OAuthDialog } from "./global/OAuthDialog";
export {
  OnboardingDialog,
  type OnboardingResult,
} from "./global/OnboardingDialog";
export { ReleaseNotesDialog } from "./global/ReleaseNotesDialog";
// Organization dialogs
export {
  CreateOrganizationDialog,
  type CreateOrganizationResult,
} from "./org/CreateOrganizationDialog";
export {
  InviteMemberDialog,
  type InviteMemberResult,
} from "./org/InviteMemberDialog";
export {
  LinkProjectDialog,
  type LinkProjectResult,
} from "./projects/LinkProjectDialog";
export {
  ProjectEditorSelectionDialog,
  type ProjectEditorSelectionDialogProps,
} from "./projects/ProjectEditorSelectionDialog";
// Project-related dialogs
export {
  ProjectFormDialog,
  type ProjectFormDialogProps,
  type ProjectFormDialogResult,
} from "./projects/ProjectFormDialog";
// Settings dialogs
export {
  CreateConfigurationDialog,
  type CreateConfigurationDialogProps,
  type CreateConfigurationResult,
} from "./settings/CreateConfigurationDialog";
export {
  DeleteConfigurationDialog,
  type DeleteConfigurationDialogProps,
  type DeleteConfigurationResult,
} from "./settings/DeleteConfigurationDialog";
// Shared/Generic dialogs
export { ConfirmDialog, type ConfirmDialogProps } from "./shared/ConfirmDialog";
export {
  FolderPickerDialog,
  type FolderPickerDialogProps,
} from "./shared/FolderPickerDialog";
export {
  ChangeTargetBranchDialog,
  type ChangeTargetBranchDialogProps,
  type ChangeTargetBranchDialogResult,
} from "./tasks/ChangeTargetBranchDialog";
export { CreateAttemptDialog } from "./tasks/CreateAttemptDialog";
export { CreatePRDialog } from "./tasks/CreatePRDialog";
export {
  DeleteTaskConfirmationDialog,
  type DeleteTaskConfirmationDialogProps,
} from "./tasks/DeleteTaskConfirmationDialog";
export {
  EditBranchNameDialog,
  type EditBranchNameDialogResult,
} from "./tasks/EditBranchNameDialog";
export {
  EditorSelectionDialog,
  type EditorSelectionDialogProps,
} from "./tasks/EditorSelectionDialog";
export {
  GitActionsDialog,
  type GitActionsDialogProps,
} from "./tasks/GitActionsDialog";
export {
  ReassignDialog,
  type ReassignDialogProps,
} from "./tasks/ReassignDialog";
export {
  RebaseDialog,
  type RebaseDialogProps,
  type RebaseDialogResult,
} from "./tasks/RebaseDialog";
export {
  RestoreLogsDialog,
  type RestoreLogsDialogProps,
  type RestoreLogsDialogResult,
} from "./tasks/RestoreLogsDialog";
export { ShareDialog, type ShareDialogProps } from "./tasks/ShareDialog";
export {
  StopShareTaskDialog,
  type StopShareTaskDialogProps,
} from "./tasks/StopShareTaskDialog";
export {
  TagEditDialog,
  type TagEditDialogProps,
  type TagEditResult,
} from "./tasks/TagEditDialog";
// Task-related dialogs
export {
  TaskFormDialog,
  type TaskFormDialogProps,
} from "./tasks/TaskFormDialog";
export {
  ViewProcessesDialog,
  type ViewProcessesDialogProps,
} from "./tasks/ViewProcessesDialog";
export {
  ViewRelatedTasksDialog,
  type ViewRelatedTasksDialogProps,
} from "./tasks/ViewRelatedTasksDialog";
