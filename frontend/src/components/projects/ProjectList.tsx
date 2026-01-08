import { AlertCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { Project } from "shared/types";
import { ProjectFormDialog } from "@/components/dialogs/projects/ProjectFormDialog";
import ProjectCard from "@/components/projects/ProjectCard.tsx";
import { ProjectCardSkeleton } from "@/components/projects/ProjectListSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { Scope, useKeyCreate } from "@/keyboard";

export function ProjectList() {
  const navigate = useNavigate();
  const { t } = useTranslation("projects");
  const { projects, isLoading, error: projectsError } = useProjects();
  const [error, setError] = useState("");
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);

  const handleCreateProject = async () => {
    try {
      const result = await ProjectFormDialog.show({});
      if (result === "saved") return;
    } catch (error) {
      // User cancelled - do nothing
    }
  };

  // Semantic keyboard shortcut for creating new project
  useKeyCreate(handleCreateProject, { scope: Scope.PROJECTS });

  const handleEditProject = (project: Project) => {
    navigate(`/settings/projects?projectId=${project.id}`);
  };

  // Set initial focus when projects are loaded
  useEffect(() => {
    if (projects.length === 0) {
      setFocusedProjectId(null);
      return;
    }

    if (
      !(focusedProjectId && projects.some((p) => p.id === focusedProjectId))
    ) {
      setFocusedProjectId(projects[0].id);
    }
  }, [projects, focusedProjectId]);

  return (
    <div className="h-full space-y-6 overflow-auto p-8 pb-16 md:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={handleCreateProject}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createProject")}
        </Button>
      </div>

      {(error || projectsError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || projectsError?.message || t("errors.fetchFailed")}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <Plus className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold text-lg">{t("empty.title")}</h3>
            <p className="mt-2 text-muted-foreground text-sm">
              {t("empty.description")}
            </p>
            <Button className="mt-4" onClick={handleCreateProject}>
              <Plus className="mr-2 h-4 w-4" />
              {t("empty.createFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              isFocused={focusedProjectId === project.id}
              key={project.id}
              onEdit={handleEditProject}
              project={project}
              setError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
