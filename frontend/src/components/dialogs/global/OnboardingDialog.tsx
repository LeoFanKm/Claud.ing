import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { ChevronDown, Code, HandMetal, Sparkles } from "lucide-react";
import { useState } from "react";
import type { EditorConfig, ExecutorProfileId } from "shared/types";
import { BaseCodingAgent, EditorType } from "shared/types";
import { APP_NAME } from "@/constants/branding";
import { AgentAvailabilityIndicator } from "@/components/AgentAvailabilityIndicator";
import { useUserSystem } from "@/components/ConfigProvider";
import { EditorAvailabilityIndicator } from "@/components/EditorAvailabilityIndicator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentAvailability } from "@/hooks/useAgentAvailability";
import { useEditorAvailability } from "@/hooks/useEditorAvailability";
import { defineModal, type NoProps } from "@/lib/modals";
import { toPrettyCase } from "@/utils/string";

export type OnboardingResult = {
  profile: ExecutorProfileId;
  editor: EditorConfig;
};

const OnboardingDialogImpl = NiceModal.create<NoProps>(() => {
  const modal = useModal();
  const { profiles, config } = useUserSystem();

  const [profile, setProfile] = useState<ExecutorProfileId>(
    config?.executor_profile || {
      executor: BaseCodingAgent.CLAUDE_CODE,
      variant: null,
    }
  );
  const [editorType, setEditorType] = useState<EditorType>(EditorType.VS_CODE);
  const [customCommand, setCustomCommand] = useState<string>("");

  const editorAvailability = useEditorAvailability(editorType);
  const agentAvailability = useAgentAvailability(profile.executor);

  const handleComplete = () => {
    modal.resolve({
      profile,
      editor: {
        editor_type: editorType,
        custom_command:
          editorType === EditorType.CUSTOM ? customCommand || null : null,
        remote_ssh_host: null,
        remote_ssh_user: null,
      },
    } as OnboardingResult);
  };

  const isValid =
    editorType !== EditorType.CUSTOM ||
    (editorType === EditorType.CUSTOM && customCommand.trim() !== "");

  return (
    <Dialog open={modal.visible} uncloseable={true}>
      <DialogContent className="space-y-4 sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <HandMetal className="h-6 w-6 text-primary text-primary-foreground" />
            <DialogTitle>Welcome to {APP_NAME}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-left">
            Let's set up your coding preferences. You can always change these
            later in Settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-xl">
            <Sparkles className="h-4 w-4" />
            Choose Your Coding Agent
          </h2>
          <div className="space-y-2">
            <Label htmlFor="profile">Default Agent</Label>
            <div className="flex gap-2">
              <Select
                onValueChange={(v) =>
                  setProfile({ executor: v as BaseCodingAgent, variant: null })
                }
                value={profile.executor}
              >
                <SelectTrigger className="flex-1" id="profile">
                  <SelectValue placeholder="Select your preferred coding agent" />
                </SelectTrigger>
                <SelectContent>
                  {/* Use profiles keys if available, otherwise fallback to all BaseCodingAgent values for web mode */}
                  {(profiles && Object.keys(profiles).length > 0
                    ? (Object.keys(profiles) as BaseCodingAgent[])
                    : Object.values(BaseCodingAgent)
                  )
                    .sort()
                    .map((agent) => (
                      <SelectItem key={agent} value={agent}>
                        {agent}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Show variant selector if selected profile has variants */}
              {(() => {
                const selectedProfile = profiles?.[profile.executor];
                const hasVariants =
                  selectedProfile && Object.keys(selectedProfile).length > 0;

                if (hasVariants) {
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="flex w-24 items-center justify-between px-2"
                          variant="outline"
                        >
                          <span className="flex-1 truncate text-left text-xs">
                            {profile.variant || "DEFAULT"}
                          </span>
                          <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {Object.keys(selectedProfile).map((variant) => (
                          <DropdownMenuItem
                            className={
                              profile.variant === variant ? "bg-accent" : ""
                            }
                            key={variant}
                            onClick={() =>
                              setProfile({
                                ...profile,
                                variant,
                              })
                            }
                          >
                            {variant}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }
                if (selectedProfile) {
                  // Show disabled button when profile exists but has no variants
                  return (
                    <Button
                      className="flex w-24 items-center justify-between px-2"
                      disabled
                      variant="outline"
                    >
                      <span className="flex-1 truncate text-left text-xs">
                        Default
                      </span>
                    </Button>
                  );
                }
                return null;
              })()}
            </div>
            <AgentAvailabilityIndicator availability={agentAvailability} />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-xl">
            <Code className="h-4 w-4" />
            Choose Your Code Editor
          </h2>

          <div className="space-y-2">
            <Label htmlFor="editor">Preferred Editor</Label>
            <Select
              onValueChange={(value: EditorType) => setEditorType(value)}
              value={editorType}
            >
              <SelectTrigger id="editor">
                <SelectValue placeholder="Select your preferred editor" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(EditorType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {toPrettyCase(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Editor availability status indicator */}
            {editorType !== EditorType.CUSTOM && (
              <EditorAvailabilityIndicator availability={editorAvailability} />
            )}

            <p className="text-muted-foreground text-sm">
              This editor will be used to open task attempts and project files.
            </p>

            {editorType === EditorType.CUSTOM && (
              <div className="space-y-2">
                <Label htmlFor="custom-command">Custom Command</Label>
                <Input
                  id="custom-command"
                  onChange={(e) => setCustomCommand(e.target.value)}
                  placeholder="e.g., code, subl, vim"
                  value={customCommand}
                />
                <p className="text-muted-foreground text-sm">
                  Enter the command to run your custom editor. Use spaces for
                  arguments (e.g., "code --wait").
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            disabled={!isValid}
            onClick={handleComplete}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export const OnboardingDialog = defineModal<void, OnboardingResult>(
  OnboardingDialogImpl
);
