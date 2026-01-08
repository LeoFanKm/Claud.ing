import { useQueryClient } from "@tanstack/react-query";
import { isEqual } from "lodash";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type { Project, ProjectRepo, Repo, UpdateProject } from "shared/types";
import { RepoPickerDialog } from "@/components/dialogs/shared/RepoPickerDialog";
import { CopyFilesField } from "@/components/projects/CopyFilesField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoExpandingTextarea } from "@/components/ui/auto-expanding-textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectMutations } from "@/hooks/useProjectMutations";
import { useProjects } from "@/hooks/useProjects";
import { repoBranchKeys } from "@/hooks/useRepoBranches";
import { useScriptPlaceholders } from "@/hooks/useScriptPlaceholders";
import { projectsApi } from "@/lib/api";

interface ProjectFormState {
  name: string;
  dev_script: string;
  dev_script_working_dir: string;
  default_agent_working_dir: string;
}

interface RepoScriptsFormState {
  setup_script: string;
  parallel_setup_script: boolean;
  cleanup_script: string;
  copy_files: string;
}

function projectToFormState(project: Project): ProjectFormState {
  return {
    name: project.name,
    dev_script: project.dev_script ?? "",
    dev_script_working_dir: project.dev_script_working_dir ?? "",
    default_agent_working_dir: project.default_agent_working_dir ?? "",
  };
}

function projectRepoToScriptsFormState(
  projectRepo: ProjectRepo | null
): RepoScriptsFormState {
  return {
    setup_script: projectRepo?.setup_script ?? "",
    parallel_setup_script: projectRepo?.parallel_setup_script ?? false,
    cleanup_script: projectRepo?.cleanup_script ?? "",
    copy_files: projectRepo?.copy_files ?? "",
  };
}

export function ProjectSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get("projectId") ?? "";
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();

  // Fetch all projects
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjects();

  // Selected project state
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    searchParams.get("projectId") || ""
  );
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Form state
  const [draft, setDraft] = useState<ProjectFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Repositories state
  const [repositories, setRepositories] = useState<Repo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [addingRepo, setAddingRepo] = useState(false);
  const [deletingRepoId, setDeletingRepoId] = useState<string | null>(null);

  // Scripts repo state (per-repo scripts)
  const [selectedScriptsRepoId, setSelectedScriptsRepoId] = useState<
    string | null
  >(null);
  const [selectedProjectRepo, setSelectedProjectRepo] =
    useState<ProjectRepo | null>(null);
  const [scriptsDraft, setScriptsDraft] = useState<RepoScriptsFormState | null>(
    null
  );
  const [loadingProjectRepo, setLoadingProjectRepo] = useState(false);
  const [savingScripts, setSavingScripts] = useState(false);
  const [scriptsSuccess, setScriptsSuccess] = useState(false);
  const [scriptsError, setScriptsError] = useState<string | null>(null);

  // Get OS-appropriate script placeholders
  const placeholders = useScriptPlaceholders();

  // Check for unsaved changes (project name)
  const hasUnsavedProjectChanges = useMemo(() => {
    if (!(draft && selectedProject)) return false;
    return !isEqual(draft, projectToFormState(selectedProject));
  }, [draft, selectedProject]);

  // Check for unsaved script changes
  const hasUnsavedScriptsChanges = useMemo(() => {
    if (!(scriptsDraft && selectedProjectRepo)) return false;
    return !isEqual(
      scriptsDraft,
      projectRepoToScriptsFormState(selectedProjectRepo)
    );
  }, [scriptsDraft, selectedProjectRepo]);

  // Combined check for any unsaved changes
  const hasUnsavedChanges =
    hasUnsavedProjectChanges || hasUnsavedScriptsChanges;

  // Handle project selection from dropdown
  const handleProjectSelect = useCallback(
    (id: string) => {
      // No-op if same project
      if (id === selectedProjectId) return;

      // Confirm if there are unsaved changes
      if (hasUnsavedChanges) {
        const confirmed = window.confirm(
          t("settings.projects.save.confirmSwitch")
        );
        if (!confirmed) return;

        // Clear local state before switching
        setDraft(null);
        setSelectedProject(null);
        setSuccess(false);
        setError(null);
      }

      // Update state and URL
      setSelectedProjectId(id);
      if (id) {
        setSearchParams({ projectId: id });
      } else {
        setSearchParams({});
      }
    },
    [hasUnsavedChanges, selectedProjectId, setSearchParams, t]
  );

  // Sync selectedProjectId when URL changes (with unsaved changes prompt)
  useEffect(() => {
    if (projectIdParam === selectedProjectId) return;

    // Confirm if there are unsaved changes
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        t("settings.projects.save.confirmSwitch")
      );
      if (!confirmed) {
        // Revert URL to previous value
        if (selectedProjectId) {
          setSearchParams({ projectId: selectedProjectId });
        } else {
          setSearchParams({});
        }
        return;
      }

      // Clear local state before switching
      setDraft(null);
      setSelectedProject(null);
      setSuccess(false);
      setError(null);
    }

    setSelectedProjectId(projectIdParam);
  }, [
    projectIdParam,
    hasUnsavedChanges,
    selectedProjectId,
    setSearchParams,
    t,
  ]);

  // Populate draft from server data
  useEffect(() => {
    if (!projects) return;

    const nextProject = selectedProjectId
      ? projects.find((p) => p.id === selectedProjectId)
      : null;

    setSelectedProject((prev) =>
      prev?.id === nextProject?.id ? prev : (nextProject ?? null)
    );

    if (!nextProject) {
      if (!hasUnsavedChanges) setDraft(null);
      return;
    }

    if (hasUnsavedChanges) return;

    setDraft(projectToFormState(nextProject));
  }, [projects, selectedProjectId, hasUnsavedChanges]);

  // Warn on tab close/navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // Fetch repositories when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setRepositories([]);
      return;
    }

    setLoadingRepos(true);
    setRepoError(null);
    projectsApi
      .getRepositories(selectedProjectId)
      .then(setRepositories)
      .catch((err) => {
        setRepoError(
          err instanceof Error ? err.message : "Failed to load repositories"
        );
        setRepositories([]);
      })
      .finally(() => setLoadingRepos(false));
  }, [selectedProjectId]);

  // Auto-select first repository for scripts when repositories load
  useEffect(() => {
    if (repositories.length > 0 && !selectedScriptsRepoId) {
      setSelectedScriptsRepoId(repositories[0].id);
    }
    // Clear selection if repo was deleted
    if (
      selectedScriptsRepoId &&
      !repositories.some((r) => r.id === selectedScriptsRepoId)
    ) {
      setSelectedScriptsRepoId(repositories[0]?.id ?? null);
    }
  }, [repositories, selectedScriptsRepoId]);

  // Reset scripts selection when project changes
  useEffect(() => {
    setSelectedScriptsRepoId(null);
    setSelectedProjectRepo(null);
    setScriptsDraft(null);
    setScriptsError(null);
  }, [selectedProjectId]);

  // Fetch ProjectRepo scripts when selected scripts repo changes
  useEffect(() => {
    if (!(selectedProjectId && selectedScriptsRepoId)) {
      setSelectedProjectRepo(null);
      setScriptsDraft(null);
      return;
    }

    setLoadingProjectRepo(true);
    setScriptsError(null);
    projectsApi
      .getRepository(selectedProjectId, selectedScriptsRepoId)
      .then((projectRepo) => {
        setSelectedProjectRepo(projectRepo);
        setScriptsDraft(projectRepoToScriptsFormState(projectRepo));
      })
      .catch((err) => {
        setScriptsError(
          err instanceof Error
            ? err.message
            : "Failed to load repository scripts"
        );
        setSelectedProjectRepo(null);
        setScriptsDraft(null);
      })
      .finally(() => setLoadingProjectRepo(false));
  }, [selectedProjectId, selectedScriptsRepoId]);

  const handleAddRepository = async () => {
    if (!selectedProjectId) return;

    const repo = await RepoPickerDialog.show({
      title: "Select Git Repository",
      description: "Choose a git repository to add to this project",
    });

    if (!repo) return;

    if (repositories.some((r) => r.id === repo.id)) {
      return;
    }

    setAddingRepo(true);
    setRepoError(null);
    try {
      const newRepo = await projectsApi.addRepository(selectedProjectId, {
        display_name: repo.display_name,
        git_repo_path: repo.path,
      });
      setRepositories((prev) => [...prev, newRepo]);
      queryClient.invalidateQueries({
        queryKey: ["projectRepositories", selectedProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: repoBranchKeys.byRepo(newRepo.id),
      });
    } catch (err) {
      setRepoError(
        err instanceof Error ? err.message : "Failed to add repository"
      );
    } finally {
      setAddingRepo(false);
    }
  };

  const handleDeleteRepository = async (repoId: string) => {
    if (!selectedProjectId) return;

    setDeletingRepoId(repoId);
    setRepoError(null);
    try {
      await projectsApi.deleteRepository(selectedProjectId, repoId);
      setRepositories((prev) => prev.filter((r) => r.id !== repoId));
      queryClient.invalidateQueries({
        queryKey: ["projectRepositories", selectedProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: repoBranchKeys.byRepo(repoId),
      });
    } catch (err) {
      setRepoError(
        err instanceof Error ? err.message : "Failed to delete repository"
      );
    } finally {
      setDeletingRepoId(null);
    }
  };

  const { updateProject } = useProjectMutations({
    onUpdateSuccess: (updatedProject: Project) => {
      // Update local state with fresh data from server
      setSelectedProject(updatedProject);
      setDraft(projectToFormState(updatedProject));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setSaving(false);
    },
    onUpdateError: (err) => {
      setError(
        err instanceof Error ? err.message : "Failed to save project settings"
      );
      setSaving(false);
    },
  });

  const handleSave = async () => {
    if (!(draft && selectedProject)) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData: UpdateProject = {
        name: draft.name.trim(),
        dev_script: draft.dev_script.trim() || null,
        dev_script_working_dir: draft.dev_script_working_dir.trim() || null,
        default_agent_working_dir:
          draft.default_agent_working_dir.trim() || null,
      };

      updateProject.mutate({
        projectId: selectedProject.id,
        data: updateData,
      });
    } catch (err) {
      setError(t("settings.projects.save.error"));
      console.error("Error saving project settings:", err);
      setSaving(false);
    }
  };

  const handleSaveScripts = async () => {
    if (!(scriptsDraft && selectedProjectId && selectedScriptsRepoId)) return;

    setSavingScripts(true);
    setScriptsError(null);
    setScriptsSuccess(false);

    try {
      const updatedRepo = await projectsApi.updateRepository(
        selectedProjectId,
        selectedScriptsRepoId,
        {
          setup_script: scriptsDraft.setup_script.trim() || null,
          cleanup_script: scriptsDraft.cleanup_script.trim() || null,
          copy_files: scriptsDraft.copy_files.trim() || null,
          parallel_setup_script: scriptsDraft.parallel_setup_script,
        }
      );
      setSelectedProjectRepo(updatedRepo);
      setScriptsDraft(projectRepoToScriptsFormState(updatedRepo));
      setScriptsSuccess(true);
      setTimeout(() => setScriptsSuccess(false), 3000);
    } catch (err) {
      setScriptsError(
        err instanceof Error ? err.message : "Failed to save scripts"
      );
    } finally {
      setSavingScripts(false);
    }
  };

  const handleDiscard = () => {
    if (!selectedProject) return;
    setDraft(projectToFormState(selectedProject));
  };

  const handleDiscardScripts = () => {
    if (!selectedProjectRepo) return;
    setScriptsDraft(projectRepoToScriptsFormState(selectedProjectRepo));
  };

  const updateDraft = (updates: Partial<ProjectFormState>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  };

  const updateScriptsDraft = (updates: Partial<RepoScriptsFormState>) => {
    setScriptsDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  };

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t("settings.projects.loading")}</span>
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {projectsError instanceof Error
              ? projectsError.message
              : t("settings.projects.loadError")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription className="font-medium">
            {t("settings.projects.save.success")}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.projects.title")}</CardTitle>
          <CardDescription>
            {t("settings.projects.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-selector">
              {t("settings.projects.selector.label")}
            </Label>
            <Select
              onValueChange={handleProjectSelect}
              value={selectedProjectId}
            >
              <SelectTrigger id="project-selector">
                <SelectValue
                  placeholder={t("settings.projects.selector.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {projects && projects.length > 0 ? (
                  projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem disabled value="no-projects">
                    {t("settings.projects.selector.noProjects")}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">
              {t("settings.projects.selector.helper")}
            </p>
          </div>
        </CardContent>
      </Card>

      {selectedProject && draft && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.projects.general.title")}</CardTitle>
              <CardDescription>
                {t("settings.projects.general.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">
                  {t("settings.projects.general.name.label")}
                </Label>
                <Input
                  id="project-name"
                  onChange={(e) => updateDraft({ name: e.target.value })}
                  placeholder={t("settings.projects.general.name.placeholder")}
                  required
                  type="text"
                  value={draft.name}
                />
                <p className="text-muted-foreground text-sm">
                  {t("settings.projects.general.name.helper")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dev-script">
                  {t("settings.projects.scripts.dev.label")}
                </Label>
                <AutoExpandingTextarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  id="dev-script"
                  maxRows={12}
                  onChange={(e) => updateDraft({ dev_script: e.target.value })}
                  placeholder={placeholders.dev}
                  value={draft.dev_script}
                />
                <p className="text-muted-foreground text-sm">
                  {t("settings.projects.scripts.dev.helper")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dev-script-working-dir">
                  {t("settings.projects.scripts.devWorkingDir.label")}
                </Label>
                <Input
                  className="font-mono"
                  id="dev-script-working-dir"
                  onChange={(e) =>
                    updateDraft({ dev_script_working_dir: e.target.value })
                  }
                  placeholder={t(
                    "settings.projects.scripts.devWorkingDir.placeholder"
                  )}
                  value={draft.dev_script_working_dir}
                />
                <p className="text-muted-foreground text-sm">
                  {t("settings.projects.scripts.devWorkingDir.helper")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-working-dir">
                  {t("settings.projects.scripts.agentWorkingDir.label")}
                </Label>
                <Input
                  className="font-mono"
                  id="agent-working-dir"
                  onChange={(e) =>
                    updateDraft({ default_agent_working_dir: e.target.value })
                  }
                  placeholder={t(
                    "settings.projects.scripts.agentWorkingDir.placeholder"
                  )}
                  value={draft.default_agent_working_dir}
                />
                <p className="text-muted-foreground text-sm">
                  {t("settings.projects.scripts.agentWorkingDir.helper")}
                </p>
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-between border-t pt-4">
                {hasUnsavedProjectChanges ? (
                  <span className="text-muted-foreground text-sm">
                    {t("settings.projects.save.unsavedChanges")}
                  </span>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    disabled={saving || !hasUnsavedProjectChanges}
                    onClick={handleDiscard}
                    variant="outline"
                  >
                    {t("settings.projects.save.discard")}
                  </Button>
                  <Button
                    disabled={saving || !hasUnsavedProjectChanges}
                    onClick={handleSave}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("settings.projects.save.saving")}
                      </>
                    ) : (
                      t("settings.projects.save.button")
                    )}
                  </Button>
                </div>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert>
                  <AlertDescription>
                    {t("settings.projects.save.success")}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Repositories Section */}
          <Card>
            <CardHeader>
              <CardTitle>Repositories</CardTitle>
              <CardDescription>
                Manage the git repositories in this project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {repoError && (
                <Alert variant="destructive">
                  <AlertDescription>{repoError}</AlertDescription>
                </Alert>
              )}

              {loadingRepos ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="ml-2 text-muted-foreground text-sm">
                    Loading repositories...
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {repositories.map((repo) => (
                    <div
                      className="flex items-center justify-between rounded-md border p-3"
                      key={repo.id}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{repo.display_name}</div>
                        <div className="truncate text-muted-foreground text-sm">
                          {repo.path}
                        </div>
                      </div>
                      <Button
                        disabled={deletingRepoId === repo.id}
                        onClick={() => handleDeleteRepository(repo.id)}
                        size="sm"
                        title="Delete repository"
                        variant="ghost"
                      >
                        {deletingRepoId === repo.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}

                  {repositories.length === 0 && !loadingRepos && (
                    <div className="py-4 text-center text-muted-foreground text-sm">
                      No repositories configured
                    </div>
                  )}

                  <Button
                    className="w-full"
                    disabled={addingRepo}
                    onClick={handleAddRepository}
                    size="sm"
                    variant="outline"
                  >
                    {addingRepo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add Repository
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.projects.scripts.title")}</CardTitle>
              <CardDescription>
                {t("settings.projects.scripts.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {scriptsError && (
                <Alert variant="destructive">
                  <AlertDescription>{scriptsError}</AlertDescription>
                </Alert>
              )}

              {scriptsSuccess && (
                <Alert variant="success">
                  <AlertDescription className="font-medium">
                    Scripts saved successfully
                  </AlertDescription>
                </Alert>
              )}

              {repositories.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground text-sm">
                  Add a repository above to configure scripts
                </div>
              ) : (
                <>
                  {/* Repository Selector for Scripts */}
                  <div className="space-y-2">
                    <Label htmlFor="scripts-repo-selector">Repository</Label>
                    <Select
                      onValueChange={setSelectedScriptsRepoId}
                      value={selectedScriptsRepoId ?? ""}
                    >
                      <SelectTrigger id="scripts-repo-selector">
                        <SelectValue placeholder="Select a repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {repositories.map((repo) => (
                          <SelectItem key={repo.id} value={repo.id}>
                            {repo.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-sm">
                      Configure scripts for each repository separately
                    </p>
                  </div>

                  {loadingProjectRepo ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="ml-2 text-muted-foreground text-sm">
                        Loading scripts...
                      </span>
                    </div>
                  ) : scriptsDraft ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="setup-script">
                          {t("settings.projects.scripts.setup.label")}
                        </Label>
                        <AutoExpandingTextarea
                          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          id="setup-script"
                          maxRows={12}
                          onChange={(e) =>
                            updateScriptsDraft({ setup_script: e.target.value })
                          }
                          placeholder={placeholders.setup}
                          value={scriptsDraft.setup_script}
                        />
                        <p className="text-muted-foreground text-sm">
                          {t("settings.projects.scripts.setup.helper")}
                        </p>

                        <div className="flex items-center space-x-2 pt-2">
                          <Checkbox
                            checked={scriptsDraft.parallel_setup_script}
                            disabled={!scriptsDraft.setup_script.trim()}
                            id="parallel-setup-script"
                            onCheckedChange={(checked) =>
                              updateScriptsDraft({
                                parallel_setup_script: checked === true,
                              })
                            }
                          />
                          <Label
                            className="cursor-pointer font-normal text-sm"
                            htmlFor="parallel-setup-script"
                          >
                            {t("settings.projects.scripts.setup.parallelLabel")}
                          </Label>
                        </div>
                        <p className="pl-6 text-muted-foreground text-sm">
                          {t("settings.projects.scripts.setup.parallelHelper")}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cleanup-script">
                          {t("settings.projects.scripts.cleanup.label")}
                        </Label>
                        <AutoExpandingTextarea
                          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          id="cleanup-script"
                          maxRows={12}
                          onChange={(e) =>
                            updateScriptsDraft({
                              cleanup_script: e.target.value,
                            })
                          }
                          placeholder={placeholders.cleanup}
                          value={scriptsDraft.cleanup_script}
                        />
                        <p className="text-muted-foreground text-sm">
                          {t("settings.projects.scripts.cleanup.helper")}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>
                          {t("settings.projects.scripts.copyFiles.label")}
                        </Label>
                        <CopyFilesField
                          onChange={(value) =>
                            updateScriptsDraft({ copy_files: value })
                          }
                          projectId={selectedProject.id}
                          value={scriptsDraft.copy_files}
                        />
                        <p className="text-muted-foreground text-sm">
                          {t("settings.projects.scripts.copyFiles.helper")}
                        </p>
                      </div>

                      {/* Scripts Save Buttons */}
                      <div className="flex items-center justify-between border-t pt-4">
                        {hasUnsavedScriptsChanges ? (
                          <span className="text-muted-foreground text-sm">
                            {t("settings.projects.save.unsavedChanges")}
                          </span>
                        ) : (
                          <span />
                        )}
                        <div className="flex gap-2">
                          <Button
                            disabled={
                              !hasUnsavedScriptsChanges || savingScripts
                            }
                            onClick={handleDiscardScripts}
                            variant="outline"
                          >
                            {t("settings.projects.save.discard")}
                          </Button>
                          <Button
                            disabled={
                              !hasUnsavedScriptsChanges || savingScripts
                            }
                            onClick={handleSaveScripts}
                          >
                            {savingScripts && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save Scripts
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          {/* Sticky Save Button for Project Name */}
          {hasUnsavedProjectChanges && (
            <div className="sticky bottom-0 z-10 border-t bg-background/80 py-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  {t("settings.projects.save.unsavedChanges")}
                </span>
                <div className="flex gap-2">
                  <Button
                    disabled={saving}
                    onClick={handleDiscard}
                    variant="outline"
                  >
                    {t("settings.projects.save.discard")}
                  </Button>
                  <Button disabled={saving} onClick={handleSave}>
                    {saving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("settings.projects.save.button")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
