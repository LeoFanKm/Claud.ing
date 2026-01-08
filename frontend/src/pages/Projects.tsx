import { useNavigate, useParams } from "react-router-dom";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import { ProjectList } from "@/components/projects/ProjectList";

export function Projects() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/projects");
  };

  if (projectId) {
    return <ProjectDetail onBack={handleBack} projectId={projectId} />;
  }

  return <ProjectList />;
}
