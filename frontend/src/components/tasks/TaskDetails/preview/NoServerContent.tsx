import {
  Edit3,
  ExternalLink,
  Play,
  Save,
  Square,
  SquareTerminal,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExecutionProcess, Project } from "shared/types";
import { useUserSystem } from "@/components/ConfigProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProjectRepos } from "@/hooks";
import { useProjectMutations } from "@/hooks/useProjectMutations";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import {
  COMPANION_INSTALL_TASK_DESCRIPTION,
  COMPANION_INSTALL_TASK_TITLE,
} from "@/utils/companionInstallTask";
import {
  createScriptPlaceholderStrategy,
  ScriptPlaceholderContext,
} from "@/utils/scriptPlaceholders";

interface NoServerContentProps {
  projectHasDevScript: boolean;
  runningDevServer: ExecutionProcess | undefined;
  isStartingDevServer: boolean;
  startDevServer: () => void;
  stopDevServer: () => void;
  project: Project | undefined;
}

export function NoServerContent({
  projectHasDevScript,
  runningDevServer,
  isStartingDevServer,
  startDevServer,
  stopDevServer,
  project,
}: NoServerContentProps) {
  const { t } = useTranslation("tasks");
  const [devScriptInput, setDevScriptInput] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isEditingExistingScript, setIsEditingExistingScript] = useState(false);
  const { system, config } = useUserSystem();

  const { createAndStart } = useTaskMutations(project?.id);
  const { updateProject } = useProjectMutations();

  const { data: projectRepos = [] } = useProjectRepos(project?.id);

  // Create strategy-based placeholders
  const placeholders = system.environment
    ? new ScriptPlaceholderContext(
        createScriptPlaceholderStrategy(system.environment.os_type)
      ).getPlaceholders()
    : {
        setup: "#!/bin/bash\nnpm install\n# Add any setup commands here...",
        dev: "#!/bin/bash\nnpm run dev\n# Add dev server start command here...",
        cleanup:
          "#!/bin/bash\n# Add cleanup commands here...\n# This runs after coding agent execution",
      };

  const handleSaveDevScript = async (startAfterSave?: boolean) => {
    setSaveError(null);
    if (!project) {
      setSaveError(t("preview.devScript.errors.notLoaded"));
      return;
    }

    const script = devScriptInput.trim();
    if (!script) {
      setSaveError(t("preview.devScript.errors.empty"));
      return;
    }

    updateProject.mutate(
      {
        projectId: project.id,
        data: {
          name: null,
          dev_script: script,
          dev_script_working_dir: project.dev_script_working_dir ?? null,
          default_agent_working_dir: project.default_agent_working_dir ?? null,
        },
      },
      {
        onSuccess: () => {
          setIsEditingExistingScript(false);
          if (startAfterSave) {
            startDevServer();
          }
        },
        onError: (err) => {
          setSaveError((err as Error)?.message || "Failed to save dev script");
        },
      }
    );
  };

  const handleEditExistingScript = () => {
    if (project?.dev_script) {
      setDevScriptInput(project.dev_script);
    }
    setIsEditingExistingScript(true);
    setSaveError(null);
  };

  const handleCancelEdit = () => {
    setIsEditingExistingScript(false);
    setDevScriptInput("");
    setSaveError(null);
  };

  const handleInstallCompanion = () => {
    if (!(project && config) || projectRepos.length === 0) return;

    const repos = projectRepos.map((repo) => ({
      repo_id: repo.id,
      target_branch: "main",
    }));

    createAndStart.mutate({
      task: {
        project_id: project.id,
        title: COMPANION_INSTALL_TASK_TITLE,
        description: COMPANION_INSTALL_TASK_DESCRIPTION,
        status: null,
        parent_workspace_id: null,
        image_ids: null,
        shared_task_id: null,
      },
      executor_profile_id: config.executor_profile,
      repos,
    });
  };

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="mx-auto max-w-md space-y-6 p-6 text-center">
        <div className="flex items-center justify-center">
          <SquareTerminal className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 font-medium text-foreground text-lg">
              {t("preview.noServer.title")}
            </h3>
            <p className="text-muted-foreground text-sm">
              {projectHasDevScript
                ? t("preview.noServer.startPrompt")
                : t("preview.noServer.setupPrompt")}
            </p>
          </div>

          {isEditingExistingScript ? (
            <div className="text-left">
              <div className="space-y-4">
                <Textarea
                  className="min-h-[120px] font-mono text-sm"
                  disabled={updateProject.isPending}
                  id="devScript"
                  onChange={(e) => setDevScriptInput(e.target.value)}
                  placeholder={placeholders.dev}
                  value={devScriptInput}
                />

                {saveError && (
                  <Alert variant="destructive">
                    <AlertDescription>{saveError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-center gap-2">
                  {isEditingExistingScript ? (
                    <>
                      <Button
                        className="gap-1"
                        disabled={updateProject.isPending}
                        onClick={() => handleSaveDevScript(false)}
                        size="sm"
                      >
                        <Save className="h-3 w-3" />
                        {t("preview.devScript.saveChanges")}
                      </Button>
                      <Button
                        className="gap-1"
                        disabled={updateProject.isPending}
                        onClick={handleCancelEdit}
                        size="sm"
                        variant="outline"
                      >
                        <X className="h-3 w-3" />
                        {t("preview.devScript.cancel")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        className="gap-1"
                        disabled={updateProject.isPending}
                        onClick={() => handleSaveDevScript(true)}
                        size="sm"
                      >
                        <Play className="h-4 w-4" />
                        {t("preview.devScript.saveAndStart")}
                      </Button>
                      <Button
                        className="gap-1"
                        disabled={updateProject.isPending}
                        onClick={() => handleSaveDevScript(false)}
                        size="sm"
                        variant="outline"
                      >
                        <Save className="h-3 w-3" />
                        {t("preview.devScript.saveOnly")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Button
                className="gap-1"
                disabled={isStartingDevServer || !projectHasDevScript}
                onClick={() => {
                  if (runningDevServer) {
                    stopDevServer();
                  } else {
                    startDevServer();
                  }
                }}
                size="sm"
                variant={runningDevServer ? "destructive" : "default"}
              >
                {runningDevServer ? (
                  <>
                    <Square className="h-4 w-4" />
                    {t("preview.toolbar.stopDevServer")}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    {t("preview.noServer.startButton")}
                  </>
                )}
              </Button>

              {!runningDevServer && (
                <Button
                  className="gap-1"
                  onClick={handleEditExistingScript}
                  size="sm"
                  variant="outline"
                >
                  <Edit3 className="h-3 w-3" />
                  {t("preview.noServer.editButton")}
                </Button>
              )}
            </div>
          )}

          <div className="space-y-4 border-border border-t pt-6">
            <p className="text-muted-foreground text-sm">
              {t("preview.noServer.companionPrompt")}
            </p>
            <div className="space-y-2">
              <Button
                className="gap-1"
                disabled={!(project && config) || createAndStart.isPending}
                onClick={handleInstallCompanion}
                size="sm"
                variant="outline"
              >
                {createAndStart.isPending
                  ? "Creating task…"
                  : "Install companion automatically"}
              </Button>
              <div>
                <a
                  className="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline dark:text-blue-400"
                  href="https://github.com/BloopAI/vibe-kanban-web-companion"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("preview.noServer.companionLink")}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
