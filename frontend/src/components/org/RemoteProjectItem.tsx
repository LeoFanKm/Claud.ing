import { Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Project, RemoteProject } from "shared/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RemoteProjectItemProps {
  remoteProject: RemoteProject;
  linkedLocalProject?: Project;
  availableLocalProjects: Project[];
  onLink: (remoteProjectId: string, localProjectId: string) => void;
  onUnlink: (localProjectId: string) => void;
  isLinking: boolean;
  isUnlinking: boolean;
}

export function RemoteProjectItem({
  remoteProject,
  linkedLocalProject,
  availableLocalProjects,
  onLink,
  onUnlink,
  isLinking,
  isUnlinking,
}: RemoteProjectItemProps) {
  const { t } = useTranslation("organization");
  const handleUnlinkClick = () => {
    if (!linkedLocalProject) return;

    const confirmed = window.confirm(
      `Are you sure you want to unlink "${linkedLocalProject.name}"? The local project will remain, but it will no longer be linked to this remote project.`
    );
    if (confirmed) {
      onUnlink(linkedLocalProject.id);
    }
  };

  const handleLinkSelect = (localProjectId: string) => {
    onLink(remoteProject.id, localProjectId);
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">{remoteProject.name}</div>
          {linkedLocalProject ? (
            <div className="text-muted-foreground text-xs">
              {t("sharedProjects.linkedTo", {
                projectName: linkedLocalProject.name,
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-xs">
              {t("sharedProjects.notLinked")}
            </div>
          )}
        </div>
        {linkedLocalProject && (
          <Badge variant="default">{t("sharedProjects.linked")}</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {linkedLocalProject ? (
          <Button
            disabled={isUnlinking}
            onClick={handleUnlinkClick}
            size="sm"
            variant="ghost"
          >
            <Unlink className="h-4 w-4 text-destructive" />
          </Button>
        ) : (
          <Select
            disabled={isLinking || availableLocalProjects.length === 0}
            onValueChange={handleLinkSelect}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("sharedProjects.linkProject")} />
            </SelectTrigger>
            <SelectContent>
              {availableLocalProjects.length === 0 ? (
                <SelectItem disabled value="no-projects">
                  {t("sharedProjects.noAvailableProjects")}
                </SelectItem>
              ) : (
                availableLocalProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
