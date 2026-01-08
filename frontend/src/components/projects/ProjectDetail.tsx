import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckSquare,
  Clock,
  Edit,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNavigateWithSearch } from "@/hooks";
import { useProjects } from "@/hooks/useProjects";
import { projectsApi } from "@/lib/api";

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

export function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const { t } = useTranslation("projects");
  const navigate = useNavigateWithSearch();
  const { projectsById, isLoading, error: projectsError } = useProjects();
  const [deleteError, setDeleteError] = useState("");

  const project = projectsById[projectId] || null;

  const handleDelete = async () => {
    if (!project) return;
    if (
      !confirm(
        `Are you sure you want to delete "${project.name}"? This action cannot be undone.`
      )
    )
      return;

    try {
      await projectsApi.delete(projectId);
      onBack();
    } catch (error) {
      console.error("Failed to delete project:", error);
      // @ts-expect-error it is type ApiError
      setDeleteError(error.message || t("errors.deleteFailed"));
      setTimeout(() => setDeleteError(""), 5000);
    }
  };

  const handleEditClick = () => {
    navigate(`/settings/projects?projectId=${projectId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading project...
      </div>
    );
  }

  if (!(project || isLoading) || projectsError) {
    const errorMsg = projectsError
      ? projectsError.message
      : t("projectNotFound");
    return (
      <div className="space-y-4 px-4 py-12">
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold text-lg">Project not found</h3>
            <p className="mt-2 text-muted-foreground text-sm">{errorMsg}</p>
            <Button className="mt-4" onClick={onBack}>
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-12">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-bold text-2xl">{project.name}</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Project details and settings
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/projects/${projectId}/tasks`)}>
            <CheckSquare className="mr-2 h-4 w-4" />
            View Tasks
          </Button>
          <Button onClick={handleEditClick} variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            className="text-destructive hover:bg-destructive/10 hover:text-destructive-foreground"
            onClick={handleDelete}
            variant="outline"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {deleteError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Project Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground text-sm">
                Status
              </span>
              <Badge variant="secondary">Active</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-2">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Updated:</span>
                <span className="ml-2">
                  {new Date(project.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Technical information about this project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                Project ID
              </h4>
              <code className="mt-1 block rounded bg-muted p-2 font-mono text-xs">
                {project.id}
              </code>
            </div>
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                Created At
              </h4>
              <p className="mt-1 text-sm">
                {new Date(project.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                Last Modified
              </h4>
              <p className="mt-1 text-sm">
                {new Date(project.updated_at).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
