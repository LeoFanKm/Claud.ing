import NiceModal, { useModal } from "@ebay/nice-modal-react";
import {
  AlertCircle,
  ArrowLeft,
  Folder,
  FolderGit,
  FolderPlus,
  Loader2,
  Search,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { DirectoryEntry, Repo } from "shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fileSystemApi, isRemoteApiEnabled, repoApi } from "@/lib/api";
import { defineModal } from "@/lib/modals";
import { FolderPickerDialog } from "./FolderPickerDialog";

export interface RepoPickerDialogProps {
  value?: string;
  title?: string;
  description?: string;
}

type Stage = "options" | "existing" | "new";

/** Manual path input component for entering repository path directly */
function ManualPathInput({
  isWorking,
  onSubmit,
  isRemoteMode,
}: {
  isWorking: boolean;
  onSubmit: (path: string) => void;
  isRemoteMode: boolean;
}) {
  const [manualPath, setManualPath] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (manualPath.trim()) {
      onSubmit(manualPath.trim());
    }
  };

  return (
    <form
      className="space-y-3 rounded-lg border border-dashed bg-card p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-start gap-3">
        <Folder className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">
            {isRemoteMode ? "Enter repository path" : "Or enter path manually"}
          </div>
          <div className="mt-1 text-muted-foreground text-xs">
            {isRemoteMode
              ? "Enter the full path to your git repository"
              : "Type the full path to a repository"}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          className="flex-1"
          disabled={isWorking}
          onChange={(e) => setManualPath(e.target.value)}
          placeholder="/path/to/your/repository"
          type="text"
          value={manualPath}
        />
        <Button
          disabled={isWorking || !manualPath.trim()}
          size="sm"
          type="submit"
          variant="outline"
        >
          Select
        </Button>
      </div>
    </form>
  );
}

const RepoPickerDialogImpl = NiceModal.create<RepoPickerDialogProps>(
  ({
    title = "Select Repository",
    description = "Choose or create a git repository",
  }) => {
    const modal = useModal();
    const [stage, setStage] = useState<Stage>("options");
    const [error, setError] = useState("");
    const [isWorking, setIsWorking] = useState(false);

    // Stage: existing
    const [allRepos, setAllRepos] = useState<DirectoryEntry[]>([]);
    const [reposLoading, setReposLoading] = useState(false);
    const [showMoreRepos, setShowMoreRepos] = useState(false);
    const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

    // Stage: new
    const [repoName, setRepoName] = useState("");
    const [parentPath, setParentPath] = useState("");

    useEffect(() => {
      if (modal.visible) {
        setStage("options");
        setError("");
        setAllRepos([]);
        setShowMoreRepos(false);
        setRepoName("");
        setParentPath("");
        setHasAttemptedLoad(false);
      }
    }, [modal.visible]);

    const loadRecentRepos = useCallback(async () => {
      // Skip loading repos in remote mode - filesystem API not available
      if (isRemoteApiEnabled) {
        setHasAttemptedLoad(true);
        return;
      }
      setReposLoading(true);
      setError("");
      setHasAttemptedLoad(true);
      try {
        const repos = await fileSystemApi.listGitRepos();
        setAllRepos(repos);
      } catch (err) {
        setError("Failed to load repositories");
        console.error("Failed to load repos:", err);
      } finally {
        setReposLoading(false);
      }
    }, []);

    useEffect(() => {
      if (
        stage === "existing" &&
        allRepos.length === 0 &&
        !reposLoading &&
        !hasAttemptedLoad
      ) {
        loadRecentRepos();
      }
    }, [
      stage,
      allRepos.length,
      reposLoading,
      hasAttemptedLoad,
      loadRecentRepos,
    ]);

    const registerAndReturn = async (path: string) => {
      setIsWorking(true);
      setError("");
      try {
        const repo = await repoApi.register({ path });
        modal.resolve(repo);
        modal.hide();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to register repository"
        );
      } finally {
        setIsWorking(false);
      }
    };

    const handleSelectRepo = (repo: DirectoryEntry) => {
      registerAndReturn(repo.path);
    };

    const handleBrowseForRepo = async () => {
      setError("");
      const selectedPath = await FolderPickerDialog.show({
        title: "Select Git Repository",
        description: "Choose an existing git repository",
      });
      if (selectedPath) {
        registerAndReturn(selectedPath);
      }
    };

    const handleCreateRepo = async () => {
      if (!repoName.trim()) {
        setError("Repository name is required");
        return;
      }

      setIsWorking(true);
      setError("");
      try {
        const repo = await repoApi.init({
          parent_path: parentPath.trim() || ".",
          folder_name: repoName.trim(),
        });
        modal.resolve(repo);
        modal.hide();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create repository"
        );
      } finally {
        setIsWorking(false);
      }
    };

    const handleCancel = () => {
      modal.resolve(null);
      modal.hide();
    };

    const handleOpenChange = (open: boolean) => {
      if (!(open || isWorking)) {
        handleCancel();
      }
    };

    const goBack = () => {
      setStage("options");
      setError("");
    };

    return (
      <div className="pointer-events-none fixed inset-0 z-[10000] [&>*]:pointer-events-auto">
        <Dialog onOpenChange={handleOpenChange} open={modal.visible}>
          <DialogContent className="w-full max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Stage: Options */}
              {stage === "options" && (
                <>
                  <div
                    className="cursor-pointer rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
                    onClick={() => setStage("existing")}
                  >
                    <div className="flex items-start gap-3">
                      <FolderGit className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">
                          From Git Repository
                        </div>
                        <div className="mt-1 text-muted-foreground text-xs">
                          Select an existing repository from your system
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Create New Repository - only available in desktop app */}
                  {!isRemoteApiEnabled && (
                    <div
                      className="cursor-pointer rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
                      onClick={() => setStage("new")}
                    >
                      <div className="flex items-start gap-3">
                        <FolderPlus className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground">
                            Create New Repository
                          </div>
                          <div className="mt-1 text-muted-foreground text-xs">
                            Initialize a new git repository
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Stage: Existing */}
              {stage === "existing" && (
                <>
                  <button
                    className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
                    disabled={isWorking}
                    onClick={goBack}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to options
                  </button>

                  {reposLoading && (
                    <div className="rounded-lg border bg-card p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                        <div className="text-muted-foreground text-sm">
                          Loading repositories...
                        </div>
                      </div>
                    </div>
                  )}

                  {!reposLoading && allRepos.length > 0 && (
                    <div className="space-y-2">
                      {allRepos
                        .slice(0, showMoreRepos ? allRepos.length : 3)
                        .map((repo) => (
                          <div
                            className="cursor-pointer rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
                            key={repo.path}
                            onClick={() => !isWorking && handleSelectRepo(repo)}
                          >
                            <div className="flex items-start gap-3">
                              <FolderGit className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground">
                                  {repo.name}
                                </div>
                                <div className="mt-1 truncate text-muted-foreground text-xs">
                                  {repo.path}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                      {!showMoreRepos && allRepos.length > 3 && (
                        <button
                          className="text-left text-muted-foreground text-sm transition-colors hover:text-foreground"
                          onClick={() => setShowMoreRepos(true)}
                        >
                          Show {allRepos.length - 3} more repositories
                        </button>
                      )}
                      {showMoreRepos && allRepos.length > 3 && (
                        <button
                          className="text-left text-muted-foreground text-sm transition-colors hover:text-foreground"
                          onClick={() => setShowMoreRepos(false)}
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  )}

                  {/* Browse for repository - only available in desktop app */}
                  {!isRemoteApiEnabled && (
                    <div
                      className="cursor-pointer rounded-lg border border-dashed bg-card p-4 transition-shadow hover:shadow-md"
                      onClick={() => !isWorking && handleBrowseForRepo()}
                    >
                      <div className="flex items-start gap-3">
                        <Search className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground">
                            Browse for repository
                          </div>
                          <div className="mt-1 text-muted-foreground text-xs">
                            Browse and select any repository on your system
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manual path input - shown in remote mode or as alternative */}
                  <ManualPathInput
                    isRemoteMode={isRemoteApiEnabled}
                    isWorking={isWorking}
                    onSubmit={registerAndReturn}
                  />
                </>
              )}

              {/* Stage: New */}
              {stage === "new" && (
                <>
                  <button
                    className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
                    disabled={isWorking}
                    onClick={goBack}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to options
                  </button>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="repo-name">
                        Repository Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        disabled={isWorking}
                        id="repo-name"
                        onChange={(e) => setRepoName(e.target.value)}
                        placeholder="my-project"
                        type="text"
                        value={repoName}
                      />
                      <p className="text-muted-foreground text-xs">
                        This will be the folder name for your new repository
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="parent-path">Parent Directory</Label>
                      <div className="flex space-x-2">
                        <Input
                          className="flex-1"
                          disabled={isWorking}
                          id="parent-path"
                          onChange={(e) => setParentPath(e.target.value)}
                          placeholder="Current Directory"
                          type="text"
                          value={parentPath}
                        />
                        <Button
                          disabled={isWorking}
                          onClick={async () => {
                            const selectedPath = await FolderPickerDialog.show({
                              title: "Select Parent Directory",
                              description:
                                "Choose where to create the new repository",
                              value: parentPath,
                            });
                            if (selectedPath) {
                              setParentPath(selectedPath);
                            }
                          }}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Folder className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Leave empty to use your current working directory
                      </p>
                    </div>

                    <Button
                      className="w-full"
                      disabled={isWorking || !repoName.trim()}
                      onClick={handleCreateRepo}
                    >
                      {isWorking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Repository"
                      )}
                    </Button>
                  </div>
                </>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isWorking && stage === "existing" && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registering repository...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

export const RepoPickerDialog = defineModal<RepoPickerDialogProps, Repo | null>(
  RepoPickerDialogImpl
);
