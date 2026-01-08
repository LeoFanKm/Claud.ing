import {
  BookOpen,
  FolderOpen,
  Menu,
  MessageCircleQuestion,
  Plus,
  Settings,
} from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ClerkAuthButtons, SignedIn } from "@/components/auth/ClerkAuth";
import { OpenInIdeButton } from "@/components/ide/OpenInIdeButton";
import { Logo } from "@/components/Logo";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProject } from "@/contexts/ProjectContext";
import { useSearch } from "@/contexts/SearchContext";
import { useProjectRepos } from "@/hooks";
import { useOpenProjectInEditor } from "@/hooks/useOpenProjectInEditor";
import { openTaskForm } from "@/lib/openTaskForm";

const INTERNAL_NAV = [
  { label: "Projects", icon: FolderOpen, to: "/projects" },
  { label: "Docs", icon: BookOpen, to: "/docs" },
];

const EXTERNAL_LINKS = [
  {
    label: "Support",
    icon: MessageCircleQuestion,
    href: "https://github.com/LeoFanKm/Claud.ing/issues",
  },
];

function NavDivider() {
  return (
    <div
      aria-orientation="vertical"
      className="mx-2 h-6 w-px bg-border/60"
      role="separator"
    />
  );
}

export function Navbar() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projectId, project } = useProject();
  const { query, setQuery, active, clear, registerInputRef } = useSearch();
  const handleOpenInEditor = useOpenProjectInEditor(project || null);

  const { data: repos } = useProjectRepos(projectId);
  const isSingleRepoProject = repos?.length === 1;

  const setSearchBarRef = useCallback(
    (node: HTMLInputElement | null) => {
      registerInputRef(node);
    },
    [registerInputRef]
  );
  const { t } = useTranslation(["tasks", "common"]);
  // Navbar is global, but the share tasks toggle only makes sense on the tasks route
  const isTasksRoute = /^\/projects\/[^/]+\/tasks/.test(location.pathname);
  const showSharedTasks = searchParams.get("shared") !== "off";
  const shouldShowSharedToggle =
    isTasksRoute && active && project?.remote_project_id != null;

  const handleSharedToggle = useCallback(
    (checked: boolean) => {
      const params = new URLSearchParams(searchParams);
      if (checked) {
        params.delete("shared");
      } else {
        params.set("shared", "off");
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleCreateTask = () => {
    if (projectId) {
      openTaskForm({ mode: "create", projectId });
    }
  };

  const handleOpenInIDE = () => {
    handleOpenInEditor();
  };

  return (
    <div className="border-b bg-background">
      <div className="w-full px-3">
        <div className="flex h-12 items-center py-2">
          <div className="flex flex-1 items-center">
            <Link to="/">
              <Logo />
            </Link>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <SearchBar
              className="shrink-0"
              disabled={!active}
              onChange={setQuery}
              onClear={clear}
              project={project || null}
              ref={setSearchBarRef}
              value={query}
            />
          </div>

          <div className="flex flex-1 items-center justify-end gap-1">
            <SignedIn>
              {shouldShowSharedToggle ? (
                <>
                  <div className="flex items-center gap-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Switch
                              aria-label={t("tasks:filters.sharedToggleAria")}
                              checked={showSharedTasks}
                              onCheckedChange={handleSharedToggle}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {t("tasks:filters.sharedToggleTooltip")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <NavDivider />
                </>
              ) : null}
            </SignedIn>

            {projectId ? (
              <>
                <div className="flex items-center gap-1">
                  {isSingleRepoProject && (
                    <OpenInIdeButton
                      className="h-9 w-9"
                      onClick={handleOpenInIDE}
                    />
                  )}
                  <Button
                    aria-label="Create new task"
                    className="h-9 w-9"
                    onClick={handleCreateTask}
                    size="icon"
                    variant="ghost"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <NavDivider />
              </>
            ) : null}

            <div className="flex items-center gap-1">
              <Button
                aria-label="Settings"
                asChild
                className="h-9 w-9"
                size="icon"
                variant="ghost"
              >
                <Link
                  to={
                    projectId
                      ? `/settings/projects?projectId=${projectId}`
                      : "/settings"
                  }
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="Main navigation"
                    className="h-9 w-9"
                    size="icon"
                    variant="ghost"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                  {INTERNAL_NAV.map((item) => {
                    const isActive = location.pathname.startsWith(item.to);
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        asChild
                        className={isActive ? "bg-accent" : ""}
                        key={item.to}
                      >
                        <Link to={item.to}>
                          <Icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}

                  <DropdownMenuSeparator />

                  {EXTERNAL_LINKS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem asChild key={item.href}>
                        <a
                          href={item.href}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Icon className="mr-2 h-4 w-4" />
                          {item.label}
                        </a>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <NavDivider />

              <ClerkAuthButtons />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
