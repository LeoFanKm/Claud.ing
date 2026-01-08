import NiceModal, { useModal } from "@ebay/nice-modal-react";
import {
  AlertCircle,
  ChevronUp,
  File,
  Folder,
  FolderOpen,
  Home,
  Search,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DirectoryEntry, DirectoryListResponse } from "shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { fileSystemApi } from "@/lib/api";
import { defineModal } from "@/lib/modals";

export interface FolderPickerDialogProps {
  value?: string;
  title?: string;
  description?: string;
}

const FolderPickerDialogImpl = NiceModal.create<FolderPickerDialogProps>(
  ({
    value = "",
    title = "Select Folder",
    description = "Choose a folder for your project",
  }) => {
    const modal = useModal();
    const { t } = useTranslation("common");
    const [currentPath, setCurrentPath] = useState<string>("");
    const [entries, setEntries] = useState<DirectoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [manualPath, setManualPath] = useState(value);
    const [searchTerm, setSearchTerm] = useState("");

    const filteredEntries = useMemo(() => {
      if (!searchTerm.trim()) return entries;
      return entries.filter((entry) =>
        entry.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }, [entries, searchTerm]);

    useEffect(() => {
      if (modal.visible) {
        setManualPath(value);
        loadDirectory();
      }
    }, [modal.visible, value]);

    const loadDirectory = async (path?: string) => {
      setLoading(true);
      setError("");

      try {
        const result: DirectoryListResponse = await fileSystemApi.list(path);

        // Ensure result exists and has the expected structure
        if (!result || typeof result !== "object") {
          throw new Error("Invalid response from file system API");
        }
        // Safely access entries, ensuring it's an array
        const entries = Array.isArray(result.entries) ? result.entries : [];
        setEntries(entries);
        const newPath = result.current_path || "";
        setCurrentPath(newPath);
        // Update manual path if we have a specific path (not for initial home directory load)
        if (path) {
          setManualPath(newPath);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load directory"
        );
        // Reset entries to empty array on error
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    const handleFolderClick = (entry: DirectoryEntry) => {
      if (entry.is_directory) {
        loadDirectory(entry.path);
        setManualPath(entry.path); // Auto-populate the manual path field
      }
    };

    const handleParentDirectory = () => {
      const parentPath = currentPath.split("/").slice(0, -1).join("/");
      const newPath = parentPath || "/";
      loadDirectory(newPath);
      setManualPath(newPath);
    };

    const handleHomeDirectory = () => {
      loadDirectory();
      // Don't set manual path here since home directory path varies by system
    };

    const handleManualPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setManualPath(e.target.value);
    };

    const handleManualPathSubmit = () => {
      loadDirectory(manualPath);
    };

    const handleSelectCurrent = () => {
      const selectedPath = manualPath || currentPath;
      modal.resolve(selectedPath);
      modal.hide();
    };

    const handleSelectManual = () => {
      modal.resolve(manualPath);
      modal.hide();
    };

    const handleCancel = () => {
      modal.resolve(null);
      modal.hide();
    };

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        handleCancel();
      }
    };

    return (
      <div className="pointer-events-none fixed inset-0 z-[10000] [&>*]:pointer-events-auto">
        <Dialog onOpenChange={handleOpenChange} open={modal.visible}>
          <DialogContent className="flex h-[700px] w-full max-w-[600px] flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 flex-col space-y-4 overflow-hidden">
              {/* Legend */}
              <div className="border-b pb-2 text-muted-foreground text-xs">
                {t("folderPicker.legend")}
              </div>

              {/* Manual path input */}
              <div className="space-y-2">
                <div className="font-medium text-sm">
                  {t("folderPicker.manualPathLabel")}
                </div>
                <div className="flex min-w-0 space-x-2">
                  <Input
                    className="min-w-0 flex-1"
                    onChange={handleManualPathChange}
                    placeholder="/path/to/your/project"
                    value={manualPath}
                  />
                  <Button
                    className="flex-shrink-0"
                    onClick={handleManualPathSubmit}
                    size="sm"
                    variant="outline"
                  >
                    {t("folderPicker.go")}
                  </Button>
                </div>
              </div>

              {/* Search input */}
              <div className="space-y-2">
                <div className="font-medium text-sm">
                  {t("folderPicker.searchLabel")}
                </div>
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                  <Input
                    className="pl-10"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter folders and files..."
                    value={searchTerm}
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex min-w-0 items-center space-x-2">
                <Button
                  className="flex-shrink-0"
                  onClick={handleHomeDirectory}
                  size="sm"
                  variant="outline"
                >
                  <Home className="h-4 w-4" />
                </Button>
                <Button
                  className="flex-shrink-0"
                  disabled={!currentPath || currentPath === "/"}
                  onClick={handleParentDirectory}
                  size="sm"
                  variant="outline"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
                  {currentPath || "Home"}
                </div>
                <Button
                  className="flex-shrink-0"
                  disabled={!currentPath}
                  onClick={handleSelectCurrent}
                  size="sm"
                  variant="outline"
                >
                  {t("folderPicker.selectCurrent")}
                </Button>
              </div>

              {/* Directory listing */}
              <div className="flex-1 overflow-auto rounded-md border">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Loading...
                  </div>
                ) : error ? (
                  <Alert className="m-4" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : filteredEntries.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {searchTerm.trim()
                      ? "No matches found"
                      : "No folders found"}
                  </div>
                ) : (
                  <div className="p-2">
                    {filteredEntries.map((entry, index) => (
                      <div
                        className={`flex cursor-pointer items-center space-x-2 rounded p-2 hover:bg-accent ${
                          entry.is_directory
                            ? ""
                            : "cursor-not-allowed opacity-50"
                        }`}
                        key={index}
                        onClick={() =>
                          entry.is_directory && handleFolderClick(entry)
                        }
                        title={entry.name} // Show full name on hover
                      >
                        {entry.is_directory ? (
                          entry.is_git_repo ? (
                            <FolderOpen className="h-4 w-4 flex-shrink-0 text-success" />
                          ) : (
                            <Folder className="h-4 w-4 flex-shrink-0 text-blue-600" />
                          )
                        ) : (
                          <File className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {entry.name}
                        </span>
                        {entry.is_git_repo && (
                          <span className="flex-shrink-0 rounded bg-green-100 px-2 py-1 text-success text-xs">
                            {t("folderPicker.gitRepo")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleCancel} type="button" variant="outline">
                {t("buttons.cancel")}
              </Button>
              <Button
                disabled={!manualPath.trim()}
                onClick={handleSelectManual}
              >
                {t("folderPicker.selectPath")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

export const FolderPickerDialog = defineModal<
  FolderPickerDialogProps,
  string | null
>(FolderPickerDialogImpl);
