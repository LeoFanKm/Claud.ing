import { Building2, Cpu, FolderOpen, Server, Settings, X } from "lucide-react";
import { useEffect } from "react";
import { useHotkeysContext } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePreviousPath } from "@/hooks/usePreviousPath";
import { useKeyExit } from "@/keyboard/hooks";
import { Scope } from "@/keyboard/registry";
import { cn } from "@/lib/utils";

const settingsNavigation = [
  {
    path: "general",
    icon: Settings,
  },
  {
    path: "projects",
    icon: FolderOpen,
  },
  {
    path: "organizations",
    icon: Building2,
  },
  {
    path: "agents",
    icon: Cpu,
  },
  {
    path: "mcp",
    icon: Server,
  },
];

export function SettingsLayout() {
  const { t } = useTranslation("settings");
  const { enableScope, disableScope } = useHotkeysContext();
  const goToPreviousPath = usePreviousPath();

  // Enable SETTINGS scope when component mounts
  useEffect(() => {
    enableScope(Scope.SETTINGS);
    return () => {
      disableScope(Scope.SETTINGS);
    };
  }, [enableScope, disableScope]);

  // Register ESC keyboard shortcut
  useKeyExit(goToPreviousPath, { scope: Scope.SETTINGS });

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto px-4 py-8">
        {/* Header with title and close button */}
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-background px-4 py-4">
          <h1 className="font-semibold text-2xl">
            {t("settings.layout.nav.title")}
          </h1>
          <Button
            className="flex h-8 items-center gap-1.5 rounded-none border border-foreground/20 px-2 transition-all hover:border-foreground/30 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={goToPreviousPath}
            variant="ghost"
          >
            <X className="h-4 w-4" />
            <span className="font-medium text-xs">ESC</span>
          </Button>
        </div>
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:sticky lg:top-24 lg:h-fit lg:max-h-[calc(100vh-8rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto">
            <div className="space-y-1">
              <nav className="space-y-1">
                {settingsNavigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      className={({ isActive }) =>
                        cn(
                          "flex items-start gap-3 px-3 py-2 text-sm transition-colors",
                          "hover:text-accent-foreground",
                          isActive
                            ? "text-primary-foreground"
                            : "text-secondary-foreground"
                        )
                      }
                      end
                      key={item.path}
                      to={item.path}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {t(`settings.layout.nav.${item.path}`)}
                        </div>
                        <div>{t(`settings.layout.nav.${item.path}Desc`)}</div>
                      </div>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
