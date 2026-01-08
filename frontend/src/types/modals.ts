import type { TaskWithAttemptStatus, Workspace } from "shared/types";
import type {
  ConfirmDialogProps,
  DeleteTaskConfirmationDialogProps,
  EditorSelectionDialogProps,
  ReassignDialogProps,
  ShareDialogProps,
  StopShareTaskDialogProps,
  TaskFormDialogProps,
} from "@/components/dialogs";

/**
 * Dialog category types for organized modal management
 * - action: Action modals that perform operations (create-pr)
 * - generic: Reusable generic modals (confirm)
 * - flow: App flow modals for onboarding/announcements
 * - task: Task-related CRUD modals
 * - share: Share task modals
 */
export type DialogCategory = "action" | "generic" | "flow" | "task" | "share";

// Type definitions for nice-modal-react modal arguments
declare module "@ebay/nice-modal-react" {
  interface ModalArgs {
    // Existing modals
    "create-pr": {
      attempt: Workspace;
      task: TaskWithAttemptStatus;
      projectId: string;
    };

    // Generic modals
    confirm: ConfirmDialogProps;

    // App flow modals
    disclaimer: void;
    onboarding: void;
    "release-notes": void;

    // Task-related modals
    "task-form": TaskFormDialogProps;
    "delete-task-confirmation": DeleteTaskConfirmationDialogProps;
    "editor-selection": EditorSelectionDialogProps;

    // Share task modals
    "share-task": ShareDialogProps;
    "reassign-shared-task": ReassignDialogProps;
    "stop-share-shared-task": StopShareTaskDialogProps;
  }
}

/** Modal ID union type extracted from ModalArgs */
export type ModalId = keyof import("@ebay/nice-modal-react").ModalArgs;

/** Modal ID to category mapping for runtime categorization */
export const MODAL_CATEGORIES: Record<ModalId, DialogCategory> = {
  // Action modals
  "create-pr": "action",

  // Generic modals
  confirm: "generic",

  // App flow modals
  disclaimer: "flow",
  onboarding: "flow",
  "release-notes": "flow",

  // Task-related modals
  "task-form": "task",
  "delete-task-confirmation": "task",
  "editor-selection": "task",

  // Share task modals
  "share-task": "share",
  "reassign-shared-task": "share",
  "stop-share-shared-task": "share",
  "transfer-shared-task": "share",
} as const;
