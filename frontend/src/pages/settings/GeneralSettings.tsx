import { cloneDeep, isEqual, merge } from "lodash";
import { Loader2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_PR_DESCRIPTION_PROMPT,
  EditorType,
  SoundFile,
  ThemeMode,
  type UiLanguage,
} from "shared/types";
import { useClerkUser } from "@/components/auth/ClerkAuth";
import { saveLocalConfig, useUserSystem } from "@/components/ConfigProvider";
import { EditorAvailabilityIndicator } from "@/components/EditorAvailabilityIndicator";
import { TagManager } from "@/components/TagManager";
import { useTheme } from "@/components/ThemeProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorAvailability } from "@/hooks/useEditorAvailability";
import { getLanguageOptions } from "@/i18n/languages";
import { toPrettyCase } from "@/utils/string";

export function GeneralSettings() {
  const { t } = useTranslation(["settings", "common"]);
  const { isSignedIn } = useClerkUser();

  // Get language options with proper display names
  const languageOptions = getLanguageOptions(
    t("language.browserDefault", {
      ns: "common",
      defaultValue: "Browser Default",
    })
  );
  const {
    config,
    loading,
    updateConfig,
    updateAndSaveConfig, // Use this on Save
  } = useUserSystem();

  // Draft state management
  const [draft, setDraft] = useState(() => (config ? cloneDeep(config) : null));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [branchPrefixError, setBranchPrefixError] = useState<string | null>(
    null
  );
  const { setTheme } = useTheme();

  // Check editor availability when draft editor changes
  const editorAvailability = useEditorAvailability(draft?.editor.editor_type);

  const validateBranchPrefix = useCallback(
    (prefix: string): string | null => {
      if (!prefix) return null; // empty allowed
      if (prefix.includes("/"))
        return t("settings.general.git.branchPrefix.errors.slash");
      if (prefix.startsWith("."))
        return t("settings.general.git.branchPrefix.errors.startsWithDot");
      if (prefix.endsWith(".") || prefix.endsWith(".lock"))
        return t("settings.general.git.branchPrefix.errors.endsWithDot");
      if (prefix.includes("..") || prefix.includes("@{"))
        return t("settings.general.git.branchPrefix.errors.invalidSequence");
      if (/[ \t~^:?*[\\]/.test(prefix))
        return t("settings.general.git.branchPrefix.errors.invalidChars");
      // Control chars check
      for (let i = 0; i < prefix.length; i++) {
        const code = prefix.charCodeAt(i);
        if (code < 0x20 || code === 0x7f)
          return t("settings.general.git.branchPrefix.errors.controlChars");
      }
      return null;
    },
    [t]
  );

  // When config loads or changes externally, update draft only if not dirty
  useEffect(() => {
    if (!config) return;
    if (!dirty) {
      setDraft(cloneDeep(config));
    }
  }, [config, dirty]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!(draft && config)) return false;
    return !isEqual(draft, config);
  }, [draft, config]);

  // Generic draft update helper
  const updateDraft = useCallback(
    (patch: Partial<typeof config>) => {
      setDraft((prev: typeof config) => {
        if (!prev) return prev;
        const next = merge({}, prev, patch);
        // Mark dirty if changed
        if (!isEqual(next, config)) {
          setDirty(true);
        }
        return next;
      });
    },
    [config]
  );

  // Optional: warn on tab close/navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const playSound = async (soundFile: SoundFile) => {
    const audio = new Audio(`/api/sounds/${soundFile}`);
    try {
      await audio.play();
    } catch (err) {
      console.error("Failed to play sound:", err);
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (isSignedIn) {
        // Logged in: save to server
        await updateAndSaveConfig(draft);
      } else {
        // Not logged in: save to localStorage and update local state
        saveLocalConfig(draft);
        updateConfig(draft);
      }
      setTheme(draft.theme);
      setDirty(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(t("settings.general.save.error"));
      console.error("Error saving config:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!config) return;
    setDraft(cloneDeep(config));
    setDirty(false);
  };

  const resetDisclaimer = async () => {
    if (!config) return;
    updateAndSaveConfig({ disclaimer_acknowledged: false });
  };

  const resetOnboarding = async () => {
    if (!config) return;
    updateAndSaveConfig({ onboarding_acknowledged: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t("settings.general.loading")}</span>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="py-8">
        <Alert variant="destructive">
          <AlertDescription>{t("settings.general.loadError")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription className="font-medium">
            {t("settings.general.save.success")}
            {!isSignedIn && (
              <span className="mt-1 block text-muted-foreground text-sm">
                {t(
                  "settings.general.save.localOnly",
                  "Settings saved locally. Sign in to sync across devices."
                )}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!(isSignedIn || success) && (
        <Alert>
          <AlertDescription>
            {t(
              "settings.general.guestMode",
              "You are not signed in. Settings will be saved locally in your browser."
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general.appearance.title")}</CardTitle>
          <CardDescription>
            {t("settings.general.appearance.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">
              {t("settings.general.appearance.theme.label")}
            </Label>
            <Select
              onValueChange={(value: ThemeMode) =>
                updateDraft({ theme: value })
              }
              value={draft?.theme}
            >
              <SelectTrigger id="theme">
                <SelectValue
                  placeholder={t(
                    "settings.general.appearance.theme.placeholder"
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ThemeMode).map((theme) => (
                  <SelectItem key={theme} value={theme}>
                    {toPrettyCase(theme)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">
              {t("settings.general.appearance.theme.helper")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">
              {t("settings.general.appearance.language.label")}
            </Label>
            <Select
              onValueChange={(value: UiLanguage) =>
                updateDraft({ language: value })
              }
              value={draft?.language}
            >
              <SelectTrigger id="language">
                <SelectValue
                  placeholder={t(
                    "settings.general.appearance.language.placeholder"
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">
              {t("settings.general.appearance.language.helper")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general.editor.title")}</CardTitle>
          <CardDescription>
            {t("settings.general.editor.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editor-type">
              {t("settings.general.editor.type.label")}
            </Label>
            <Select
              onValueChange={(value: EditorType) =>
                updateDraft({
                  editor: { ...draft!.editor, editor_type: value },
                })
              }
              value={draft?.editor.editor_type}
            >
              <SelectTrigger id="editor-type">
                <SelectValue
                  placeholder={t("settings.general.editor.type.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {Object.values(EditorType).map((editor) => (
                  <SelectItem key={editor} value={editor}>
                    {toPrettyCase(editor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Editor availability status indicator */}
            {draft?.editor.editor_type !== EditorType.CUSTOM && (
              <EditorAvailabilityIndicator availability={editorAvailability} />
            )}

            <p className="text-muted-foreground text-sm">
              {t("settings.general.editor.type.helper")}
            </p>
          </div>

          {draft?.editor.editor_type === EditorType.CUSTOM && (
            <div className="space-y-2">
              <Label htmlFor="custom-command">
                {t("settings.general.editor.customCommand.label")}
              </Label>
              <Input
                id="custom-command"
                onChange={(e) =>
                  updateDraft({
                    editor: {
                      ...draft!.editor,
                      custom_command: e.target.value || null,
                    },
                  })
                }
                placeholder={t(
                  "settings.general.editor.customCommand.placeholder"
                )}
                value={draft?.editor.custom_command || ""}
              />
              <p className="text-muted-foreground text-sm">
                {t("settings.general.editor.customCommand.helper")}
              </p>
            </div>
          )}

          {(draft?.editor.editor_type === EditorType.VS_CODE ||
            draft?.editor.editor_type === EditorType.CURSOR ||
            draft?.editor.editor_type === EditorType.WINDSURF) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="remote-ssh-host">
                  {t("settings.general.editor.remoteSsh.host.label")}
                </Label>
                <Input
                  id="remote-ssh-host"
                  onChange={(e) =>
                    updateDraft({
                      editor: {
                        ...draft!.editor,
                        remote_ssh_host: e.target.value || null,
                      },
                    })
                  }
                  placeholder={t(
                    "settings.general.editor.remoteSsh.host.placeholder"
                  )}
                  value={draft?.editor.remote_ssh_host || ""}
                />
                <p className="text-muted-foreground text-sm">
                  {t("settings.general.editor.remoteSsh.host.helper")}
                </p>
              </div>

              {draft?.editor.remote_ssh_host && (
                <div className="space-y-2">
                  <Label htmlFor="remote-ssh-user">
                    {t("settings.general.editor.remoteSsh.user.label")}
                  </Label>
                  <Input
                    id="remote-ssh-user"
                    onChange={(e) =>
                      updateDraft({
                        editor: {
                          ...draft!.editor,
                          remote_ssh_user: e.target.value || null,
                        },
                      })
                    }
                    placeholder={t(
                      "settings.general.editor.remoteSsh.user.placeholder"
                    )}
                    value={draft?.editor.remote_ssh_user || ""}
                  />
                  <p className="text-muted-foreground text-sm">
                    {t("settings.general.editor.remoteSsh.user.helper")}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general.git.title")}</CardTitle>
          <CardDescription>
            {t("settings.general.git.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="git-branch-prefix">
              {t("settings.general.git.branchPrefix.label")}
            </Label>
            <Input
              aria-invalid={!!branchPrefixError}
              className={branchPrefixError ? "border-destructive" : undefined}
              id="git-branch-prefix"
              onChange={(e) => {
                const value = e.target.value.trim();
                updateDraft({ git_branch_prefix: value });
                setBranchPrefixError(validateBranchPrefix(value));
              }}
              placeholder={t("settings.general.git.branchPrefix.placeholder")}
              type="text"
              value={draft?.git_branch_prefix ?? ""}
            />
            {branchPrefixError && (
              <p className="text-destructive text-sm">{branchPrefixError}</p>
            )}
            <p className="text-muted-foreground text-sm">
              {t("settings.general.git.branchPrefix.helper")}{" "}
              {draft?.git_branch_prefix ? (
                <>
                  {t("settings.general.git.branchPrefix.preview")}{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {t("settings.general.git.branchPrefix.previewWithPrefix", {
                      prefix: draft.git_branch_prefix,
                    })}
                  </code>
                </>
              ) : (
                <>
                  {t("settings.general.git.branchPrefix.preview")}{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {t("settings.general.git.branchPrefix.previewNoPrefix")}
                  </code>
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general.pullRequests.title")}</CardTitle>
          <CardDescription>
            {t("settings.general.pullRequests.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={draft?.pr_auto_description_enabled ?? false}
              id="pr-auto-description"
              onCheckedChange={(checked: boolean) =>
                updateDraft({ pr_auto_description_enabled: checked })
              }
            />
            <div className="space-y-0.5">
              <Label className="cursor-pointer" htmlFor="pr-auto-description">
                {t("settings.general.pullRequests.autoDescription.label")}
              </Label>
              <p className="text-muted-foreground text-sm">
                {t("settings.general.pullRequests.autoDescription.helper")}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={draft?.pr_auto_description_prompt != null}
              id="use-custom-prompt"
              onCheckedChange={(checked: boolean) => {
                if (checked) {
                  updateDraft({
                    pr_auto_description_prompt: DEFAULT_PR_DESCRIPTION_PROMPT,
                  });
                } else {
                  updateDraft({ pr_auto_description_prompt: null });
                }
              }}
            />
            <Label className="cursor-pointer" htmlFor="use-custom-prompt">
              {t("settings.general.pullRequests.customPrompt.useCustom")}
            </Label>
          </div>
          <div className="space-y-2">
            <textarea
              className={`flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                draft?.pr_auto_description_prompt == null
                  ? "cursor-not-allowed opacity-50"
                  : ""
              }`}
              disabled={draft?.pr_auto_description_prompt == null}
              id="pr-custom-prompt"
              onChange={(e) =>
                updateDraft({
                  pr_auto_description_prompt: e.target.value,
                })
              }
              value={
                draft?.pr_auto_description_prompt ??
                DEFAULT_PR_DESCRIPTION_PROMPT
              }
            />
            <p className="text-muted-foreground text-sm">
              {t("settings.general.pullRequests.customPrompt.helper")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general.notifications.title")}</CardTitle>
          <CardDescription>
            {t("settings.general.notifications.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={draft?.notifications.sound_enabled}
              id="sound-enabled"
              onCheckedChange={(checked: boolean) =>
                updateDraft({
                  notifications: {
                    ...draft!.notifications,
                    sound_enabled: checked,
                  },
                })
              }
            />
            <div className="space-y-0.5">
              <Label className="cursor-pointer" htmlFor="sound-enabled">
                {t("settings.general.notifications.sound.label")}
              </Label>
              <p className="text-muted-foreground text-sm">
                {t("settings.general.notifications.sound.helper")}
              </p>
            </div>
          </div>
          {draft?.notifications.sound_enabled && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="sound-file">
                {t("settings.general.notifications.sound.fileLabel")}
              </Label>
              <div className="flex gap-2">
                <Select
                  onValueChange={(value: SoundFile) =>
                    updateDraft({
                      notifications: {
                        ...draft.notifications,
                        sound_file: value,
                      },
                    })
                  }
                  value={draft.notifications.sound_file}
                >
                  <SelectTrigger className="flex-1" id="sound-file">
                    <SelectValue
                      placeholder={t(
                        "settings.general.notifications.sound.filePlaceholder"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(SoundFile).map((soundFile) => (
                      <SelectItem key={soundFile} value={soundFile}>
                        {toPrettyCase(soundFile)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="px-3"
                  onClick={() => playSound(draft.notifications.sound_file)}
                  size="sm"
                  variant="outline"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                {t("settings.general.notifications.sound.fileHelper")}
              </p>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={draft?.notifications.push_enabled}
              id="push-notifications"
              onCheckedChange={(checked: boolean) =>
                updateDraft({
                  notifications: {
                    ...draft!.notifications,
                    push_enabled: checked,
                  },
                })
              }
            />
            <div className="space-y-0.5">
              <Label className="cursor-pointer" htmlFor="push-notifications">
                {t("settings.general.notifications.push.label")}
              </Label>
              <p className="text-muted-foreground text-sm">
                {t("settings.general.notifications.push.helper")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general.privacy.title")}</CardTitle>
          <CardDescription>
            {t("settings.general.privacy.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={draft?.analytics_enabled ?? false}
              id="analytics-enabled"
              onCheckedChange={(checked: boolean) =>
                updateDraft({ analytics_enabled: checked })
              }
            />
            <div className="space-y-0.5">
              <Label className="cursor-pointer" htmlFor="analytics-enabled">
                {t("settings.general.privacy.telemetry.label")}
              </Label>
              <p className="text-muted-foreground text-sm">
                {t("settings.general.privacy.telemetry.helper")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general.taskTemplates.title")}</CardTitle>
          <CardDescription>
            {t("settings.general.taskTemplates.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagManager />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general.safety.title")}</CardTitle>
          <CardDescription>
            {t("settings.general.safety.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {t("settings.general.safety.disclaimer.title")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("settings.general.safety.disclaimer.description")}
              </p>
            </div>
            <Button onClick={resetDisclaimer} variant="outline">
              {t("settings.general.safety.disclaimer.button")}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {t("settings.general.safety.onboarding.title")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("settings.general.safety.onboarding.description")}
              </p>
            </div>
            <Button onClick={resetOnboarding} variant="outline">
              {t("settings.general.safety.onboarding.button")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Save Button */}
      <div className="sticky bottom-0 z-10 border-t bg-background/80 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          {hasUnsavedChanges ? (
            <span className="text-muted-foreground text-sm">
              {t("settings.general.save.unsavedChanges")}
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              disabled={!hasUnsavedChanges || saving}
              onClick={handleDiscard}
              variant="outline"
            >
              {t("settings.general.save.discard")}
            </Button>
            <Button
              disabled={!hasUnsavedChanges || saving || !!branchPrefixError}
              onClick={handleSave}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("settings.general.save.button")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
