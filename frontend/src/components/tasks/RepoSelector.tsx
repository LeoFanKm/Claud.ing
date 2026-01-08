import { ChevronsUpDown, FolderGit } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Repo } from "shared/types";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

type Props = {
  repos: Repo[];
  selectedRepoId: string | null;
  onRepoSelect: (repoId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function RepoSelector({
  repos,
  selectedRepoId,
  onRepoSelect,
  placeholder,
  className = "",
  disabled = false,
}: Props) {
  const { t } = useTranslation(["tasks"]);
  const [open, setOpen] = useState(false);

  const effectivePlaceholder =
    placeholder ?? t("repos.selector.placeholder", "Select repository");

  const selectedRepo = repos.find((r) => r.id === selectedRepoId);

  const handleRepoSelect = useCallback(
    (repoId: string) => {
      onRepoSelect(repoId);
      setOpen(false);
    },
    [onRepoSelect]
  );

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          className={`w-full justify-between text-xs ${className}`}
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <FolderGit className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {selectedRepo?.display_name || effectivePlaceholder}
            </span>
          </div>
          {repos.length > 1 && (
            <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64">
        {repos.length === 0 ? (
          <div className="p-2 text-center text-muted-foreground text-sm">
            {t("repos.selector.empty", "No repositories available")}
          </div>
        ) : (
          repos.map((repo) => {
            const isSelected = selectedRepoId === repo.id;
            return (
              <DropdownMenuItem
                className={isSelected ? "bg-accent text-accent-foreground" : ""}
                key={repo.id}
                onSelect={() => handleRepoSelect(repo.id)}
              >
                <div className="flex w-full items-center gap-2">
                  <FolderGit className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{repo.display_name}</span>
                </div>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default RepoSelector;
