import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useForm, useStore } from "@tanstack/react-form";
import { Image as ImageIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useHotkeysContext } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import type {
  ExecutorProfileId,
  ImageResponse,
  TaskStatus,
} from "shared/types";
import { useUserSystem } from "@/components/ConfigProvider";
import { ExecutorProfileSelector } from "@/components/settings";
import BranchSelector from "@/components/tasks/BranchSelector";
import RepoBranchSelector from "@/components/tasks/RepoBranchSelector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import WYSIWYGEditor from "@/components/ui/wysiwyg";
import type { LocalImageMetadata } from "@/components/ui/wysiwyg/context/task-attempt-context";
import {
  useImageUpload,
  useProjectRepos,
  useRepoBranchSelection,
  useTaskImages,
  useTaskMutations,
} from "@/hooks";
import {
  Scope,
  useKeyExit,
  useKeySubmitTask,
  useKeySubmitTaskAlt,
} from "@/keyboard";
import { defineModal } from "@/lib/modals";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export type TaskFormDialogProps =
  | { mode: "create"; projectId: string }
  | { mode: "edit"; projectId: string; task: Task }
  | { mode: "duplicate"; projectId: string; initialTask: Task }
  | {
      mode: "subtask";
      projectId: string;
      parentTaskAttemptId: string;
      initialBaseBranch: string;
    };

type RepoBranch = { repoId: string; branch: string };

type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  executorProfileId: ExecutorProfileId | null;
  repoBranches: RepoBranch[];
  autoStart: boolean;
};

const TaskFormDialogImpl = NiceModal.create<TaskFormDialogProps>((props) => {
  const { mode, projectId } = props;
  const editMode = mode === "edit";
  const modal = useModal();
  const { t } = useTranslation(["tasks", "common"]);
  const { createTask, createAndStart, updateTask } =
    useTaskMutations(projectId);
  const { system, profiles, loading: userSystemLoading } = useUserSystem();
  const { upload, uploadForTask } = useImageUpload();
  const { enableScope, disableScope } = useHotkeysContext();

  // Local UI state
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [newlyUploadedImageIds, setNewlyUploadedImageIds] = useState<string[]>(
    []
  );
  const [showDiscardWarning, setShowDiscardWarning] = useState(false);
  const forceCreateOnlyRef = useRef(false);

  const { data: taskImages } = useTaskImages(
    editMode ? props.task.id : undefined
  );
  const { data: projectRepos = [] } = useProjectRepos(projectId, {
    enabled: modal.visible,
  });
  const initialBranch =
    mode === "subtask" ? props.initialBaseBranch : undefined;
  const { configs: repoBranchConfigs, isLoading: branchesLoading } =
    useRepoBranchSelection({
      repos: projectRepos,
      initialBranch,
      enabled: modal.visible && projectRepos.length > 0,
    });

  const defaultRepoBranches = useMemo((): RepoBranch[] => {
    return repoBranchConfigs
      .filter((c) => c.targetBranch !== null)
      .map((c) => ({ repoId: c.repoId, branch: c.targetBranch! }));
  }, [repoBranchConfigs]);

  // Get default form values based on mode
  const defaultValues = useMemo((): TaskFormValues => {
    const baseProfile = system.config?.executor_profile || null;

    switch (mode) {
      case "edit":
        return {
          title: props.task.title,
          description: props.task.description || "",
          status: props.task.status,
          executorProfileId: baseProfile,
          repoBranches: defaultRepoBranches,
          autoStart: false,
        };

      case "duplicate":
        return {
          title: props.initialTask.title,
          description: props.initialTask.description || "",
          status: "todo",
          executorProfileId: baseProfile,
          repoBranches: defaultRepoBranches,
          autoStart: true,
        };

      case "subtask":
      case "create":
      default:
        return {
          title: "",
          description: "",
          status: "todo",
          executorProfileId: baseProfile,
          repoBranches: defaultRepoBranches,
          autoStart: true,
        };
    }
  }, [mode, props, system.config?.executor_profile, defaultRepoBranches]);

  // Form submission handler
  const handleSubmit = async ({ value }: { value: TaskFormValues }) => {
    if (editMode) {
      await updateTask.mutateAsync(
        {
          taskId: props.task.id,
          data: {
            title: value.title,
            description: value.description,
            status: value.status,
            parent_workspace_id: null,
            image_ids: images.length > 0 ? images.map((img) => img.id) : null,
          },
        },
        { onSuccess: () => modal.remove() }
      );
    } else {
      const imageIds =
        newlyUploadedImageIds.length > 0 ? newlyUploadedImageIds : null;
      const task = {
        project_id: projectId,
        title: value.title,
        description: value.description,
        status: null,
        parent_workspace_id:
          mode === "subtask" ? props.parentTaskAttemptId : null,
        image_ids: imageIds,
        shared_task_id: null,
      };
      const shouldAutoStart = value.autoStart && !forceCreateOnlyRef.current;
      if (shouldAutoStart) {
        const repos = value.repoBranches.map((rb) => ({
          repo_id: rb.repoId,
          target_branch: rb.branch,
        }));
        await createAndStart.mutateAsync(
          {
            task,
            executor_profile_id: value.executorProfileId!,
            repos,
          },
          { onSuccess: () => modal.remove() }
        );
      } else {
        await createTask.mutateAsync(task, { onSuccess: () => modal.remove() });
      }
    }
  };

  const validator = (value: TaskFormValues): string | undefined => {
    if (!value.title.trim().length) return "need title";
    if (value.autoStart && !forceCreateOnlyRef.current) {
      if (!value.executorProfileId) return "need executor profile";
      if (
        value.repoBranches.length === 0 ||
        value.repoBranches.some((rb) => !rb.branch)
      ) {
        return "need branch for all repos";
      }
    }
  };

  // Initialize TanStack Form
  const form = useForm({
    defaultValues,
    onSubmit: handleSubmit,
    validators: {
      // we use an onMount validator so that the primary action button can
      // enable/disable itself based on `canSubmit`
      onMount: ({ value }) => validator(value),
      onChange: ({ value }) => validator(value),
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const isDirty = useStore(form.store, (state) => state.isDirty);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);

  // Load images for edit mode
  useEffect(() => {
    if (!taskImages) return;
    setImages(taskImages);
  }, [taskImages]);

  const onDrop = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          // In edit mode, use uploadForTask to associate immediately
          // In create mode, use plain upload (will associate on task creation)
          const img = editMode
            ? await uploadForTask(props.task.id, file)
            : await upload(file);

          // Add markdown image reference to description
          const markdownText = `![${img.original_name}](${img.file_path})`;
          form.setFieldValue("description", (prev) =>
            prev.trim() === "" ? markdownText : `${prev} ${markdownText}`
          );
          setImages((prev) => [...prev, img]);
          setNewlyUploadedImageIds((prev) => [...prev, img.id]);
        } catch {
          // Silently ignore upload errors for now
        }
      }
    },
    [editMode, props, upload, uploadForTask, form]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: dropzoneOpen,
  } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    disabled: isSubmitting,
    noClick: true,
    noKeyboard: true,
  });

  // Compute localImages for WYSIWYG rendering of uploaded images
  const localImages: LocalImageMetadata[] = useMemo(
    () =>
      images.map((img) => ({
        path: img.file_path,
        proxy_url: `/api/images/${img.id}/file`,
        file_name: img.original_name,
        size_bytes: Number(img.size_bytes),
        format: img.mime_type?.split("/")[1] ?? "png",
      })),
    [images]
  );

  // Unsaved changes detection
  const hasUnsavedChanges = useCallback(() => {
    if (isDirty) return true;
    if (newlyUploadedImageIds.length > 0) return true;
    if (images.length > 0 && !editMode) return true;
    return false;
  }, [isDirty, newlyUploadedImageIds, images, editMode]);

  // beforeunload listener
  useEffect(() => {
    if (!modal.visible || isSubmitting) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [modal.visible, isSubmitting, hasUnsavedChanges]);

  // Keyboard shortcuts
  const primaryAction = useCallback(() => {
    if (isSubmitting || !canSubmit) return;
    void form.handleSubmit();
  }, [form, isSubmitting, canSubmit]);

  const shortcutsEnabled =
    modal.visible && !isSubmitting && canSubmit && !showDiscardWarning;

  useKeySubmitTask(primaryAction, {
    enabled: shortcutsEnabled,
    scope: Scope.DIALOG,
    enableOnFormTags: ["input", "INPUT", "textarea", "TEXTAREA"],
    preventDefault: true,
  });

  const canSubmitAlt = useStore(
    form.store,
    (state) => state.values.title.trim().length > 0 && !state.isSubmitting
  );

  const handleSubmitCreateOnly = useCallback(() => {
    forceCreateOnlyRef.current = true;
    const promise = form.handleSubmit();
    Promise.resolve(promise).finally(() => {
      forceCreateOnlyRef.current = false;
    });
  }, [form]);

  useKeySubmitTaskAlt(handleSubmitCreateOnly, {
    enabled: modal.visible && canSubmitAlt && !showDiscardWarning,
    scope: Scope.DIALOG,
    enableOnFormTags: ["input", "INPUT", "textarea", "TEXTAREA"],
    preventDefault: true,
  });

  // Dialog close handling
  const handleDialogClose = (open: boolean) => {
    if (open) return;
    if (hasUnsavedChanges()) {
      setShowDiscardWarning(true);
    } else {
      modal.remove();
    }
  };

  const handleDiscardChanges = () => {
    form.reset();
    setImages([]);
    setNewlyUploadedImageIds([]);
    setShowDiscardWarning(false);
    modal.remove();
  };

  const handleContinueEditing = () => {
    setShowDiscardWarning(false);
  };

  // Manage CONFIRMATION scope when warning is shown
  useEffect(() => {
    if (showDiscardWarning) {
      disableScope(Scope.DIALOG);
      enableScope(Scope.CONFIRMATION);
    } else {
      disableScope(Scope.CONFIRMATION);
      enableScope(Scope.DIALOG);
    }
  }, [showDiscardWarning, enableScope, disableScope]);

  useKeyExit(handleContinueEditing, {
    scope: Scope.CONFIRMATION,
    when: () => modal.visible && showDiscardWarning,
  });

  const loading = branchesLoading || userSystemLoading;
  if (loading) return <></>;

  return (
    <>
      <Dialog
        className="flex max-h-[min(95vh,50rem)] w-full max-w-[min(90vw,40rem)] flex-col overflow-hidden"
        onOpenChange={handleDialogClose}
        open={modal.visible}
        uncloseable={showDiscardWarning}
      >
        <div
          {...getRootProps()}
          className="relative flex h-full min-h-0 flex-col gap-4 p-4"
        >
          <input {...getInputProps()} />
          {/* Drag overlay */}
          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-primary-foreground/50 border-dashed bg-primary/95">
              <div className="text-center">
                <ImageIcon className="mx-auto mb-2 h-12 w-12 text-primary-foreground" />
                <p className="font-medium text-lg text-primary-foreground">
                  {t("taskFormDialog.dropImagesHere")}
                </p>
              </div>
            </div>
          )}

          {/* Title */}
          <div className="flex-none border border-1 border-border px-4 py-2">
            <form.Field name="title">
              {(field) => (
                <Input
                  autoFocus
                  className="border-none p-0 font-semibold text-lg placeholder:text-muted-foreground/60"
                  disabled={isSubmitting}
                  id="task-title"
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("taskFormDialog.titlePlaceholder")}
                  value={field.state.value}
                />
              )}
            </form.Field>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain border border-1 border-border p-4">
            {/* Description */}
            <form.Field name="description">
              {(field) => (
                <WYSIWYGEditor
                  className="border-none px-0 font-normal text-md shadow-none"
                  disabled={isSubmitting}
                  localImages={localImages}
                  onChange={(desc) => field.handleChange(desc)}
                  onCmdEnter={primaryAction}
                  onPasteFiles={onDrop}
                  onShiftCmdEnter={handleSubmitCreateOnly}
                  placeholder={t("taskFormDialog.descriptionPlaceholder")}
                  projectId={projectId}
                  taskId={editMode ? props.task.id : undefined}
                  value={field.state.value}
                />
              )}
            </form.Field>
            {/* Edit mode status */}
            {editMode && (
              <form.Field name="status">
                {(field) => (
                  <div className="space-y-2">
                    <Label
                      className="font-medium text-sm"
                      htmlFor="task-status"
                    >
                      {t("taskFormDialog.statusLabel")}
                    </Label>
                    <Select
                      disabled={isSubmitting}
                      onValueChange={(value) =>
                        field.handleChange(value as TaskStatus)
                      }
                      value={field.state.value}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">
                          {t("taskFormDialog.statusOptions.todo")}
                        </SelectItem>
                        <SelectItem value="inprogress">
                          {t("taskFormDialog.statusOptions.inprogress")}
                        </SelectItem>
                        <SelectItem value="inreview">
                          {t("taskFormDialog.statusOptions.inreview")}
                        </SelectItem>
                        <SelectItem value="done">
                          {t("taskFormDialog.statusOptions.done")}
                        </SelectItem>
                        <SelectItem value="cancelled">
                          {t("taskFormDialog.statusOptions.cancelled")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
            )}
          </div>

          {/* Create mode dropdowns */}
          {!editMode && (
            <form.Field mode="array" name="autoStart">
              {(autoStartField) => {
                const isSingleRepo = repoBranchConfigs.length === 1;
                return (
                  <div
                    className={cn(
                      "my-2 py-2 transition-opacity duration-200",
                      isSingleRepo ? "" : "space-y-3",
                      autoStartField.state.value
                        ? "opacity-100"
                        : "pointer-events-none opacity-0"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <form.Field name="executorProfileId">
                        {(field) => (
                          <ExecutorProfileSelector
                            className="flex min-w-0 flex-[2] flex-row items-center gap-2"
                            disabled={
                              isSubmitting || !autoStartField.state.value
                            }
                            itemClassName="flex-1 min-w-0"
                            onProfileSelect={(profile) =>
                              field.handleChange(profile)
                            }
                            profiles={profiles}
                            selectedProfile={field.state.value}
                            showLabel={false}
                          />
                        )}
                      </form.Field>
                      {isSingleRepo && (
                        <form.Field name="repoBranches">
                          {(field) => {
                            const config = repoBranchConfigs[0];
                            const selectedBranch =
                              field.state.value.find(
                                (v) => v.repoId === config.repoId
                              )?.branch ?? config.targetBranch;
                            return (
                              <div
                                className={cn(
                                  "min-w-0 flex-1",
                                  isSubmitting &&
                                    "pointer-events-none opacity-50"
                                )}
                              >
                                <BranchSelector
                                  branches={config.branches}
                                  onBranchSelect={(branch) => {
                                    field.handleChange([
                                      { repoId: config.repoId, branch },
                                    ]);
                                  }}
                                  placeholder={
                                    branchesLoading
                                      ? t("createAttemptDialog.loadingBranches")
                                      : t("createAttemptDialog.selectBranch")
                                  }
                                  selectedBranch={selectedBranch}
                                />
                              </div>
                            );
                          }}
                        </form.Field>
                      )}
                    </div>
                    {!isSingleRepo && (
                      <form.Field name="repoBranches">
                        {(field) => {
                          const configs = repoBranchConfigs.map((config) => ({
                            ...config,
                            targetBranch:
                              field.state.value.find(
                                (v) => v.repoId === config.repoId
                              )?.branch ?? config.targetBranch,
                          }));
                          return (
                            <RepoBranchSelector
                              className={cn(
                                isSubmitting && "pointer-events-none opacity-50"
                              )}
                              configs={configs}
                              isLoading={branchesLoading}
                              onBranchChange={(repoId, branch) => {
                                const newValue = field.state.value.map((v) =>
                                  v.repoId === repoId ? { ...v, branch } : v
                                );
                                if (
                                  !newValue.find((v) => v.repoId === repoId)
                                ) {
                                  newValue.push({ repoId, branch });
                                }
                                field.handleChange(newValue);
                              }}
                              showLabel={true}
                            />
                          );
                        }}
                      </form.Field>
                    )}
                  </div>
                );
              }}
            </form.Field>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            {/* Attach Image*/}
            <div className="flex items-center gap-2">
              <Button
                aria-label={t("taskFormDialog.attachImage")}
                className="h-9 w-9 rounded-none p-0"
                onClick={dropzoneOpen}
                size="sm"
                variant="outline"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Autostart switch */}
            <div className="flex items-center gap-3">
              {!editMode && (
                <form.Field name="autoStart">
                  {(field) => (
                    <div className="flex items-center gap-2">
                      <Switch
                        aria-label={t("taskFormDialog.startLabel")}
                        checked={field.state.value}
                        className="data-[state=checked]:bg-gray-900 dark:data-[state=checked]:bg-gray-100"
                        disabled={isSubmitting}
                        id="autostart-switch"
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                      />
                      <Label
                        className="cursor-pointer text-sm"
                        htmlFor="autostart-switch"
                      >
                        {t("taskFormDialog.startLabel")}
                      </Label>
                    </div>
                  )}
                </form.Field>
              )}

              {/* Create/Start/Update button*/}
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                  values: state.values,
                })}
              >
                {({ canSubmit, isSubmitting, values }) => {
                  const buttonText = editMode
                    ? isSubmitting
                      ? t("taskFormDialog.updating")
                      : t("taskFormDialog.updateTask")
                    : isSubmitting
                      ? values.autoStart
                        ? t("taskFormDialog.starting")
                        : t("taskFormDialog.creating")
                      : t("taskFormDialog.create");

                  return (
                    <Button disabled={!canSubmit} onClick={form.handleSubmit}>
                      {buttonText}
                    </Button>
                  );
                }}
              </form.Subscribe>
            </div>
          </div>
        </div>
      </Dialog>
      {showDiscardWarning && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowDiscardWarning(false)}
          />
          <div className="relative z-[10000] my-8 grid w-full max-w-lg gap-4 bg-primary p-6 shadow-lg duration-200 sm:rounded-lg">
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle>
                    {t("taskFormDialog.discardDialog.title")}
                  </DialogTitle>
                </div>
                <DialogDescription className="pt-2 text-left">
                  {t("taskFormDialog.discardDialog.description")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button onClick={handleContinueEditing} variant="outline">
                  {t("taskFormDialog.discardDialog.continueEditing")}
                </Button>
                <Button onClick={handleDiscardChanges} variant="destructive">
                  {t("taskFormDialog.discardDialog.discardChanges")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </div>
        </div>
      )}
    </>
  );
});

export const TaskFormDialog = defineModal<TaskFormDialogProps, void>(
  TaskFormDialogImpl
);
