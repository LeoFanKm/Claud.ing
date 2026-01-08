import { useClerk } from "@clerk/clerk-react";
import { LogIn, type LucideIcon } from "lucide-react";
import { type ComponentProps, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { OAuthDialog } from "@/components/dialogs/global/OAuthDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useClerkEnabled, useClerkLoaded } from "@/contexts/ClerkContext";
import { cn } from "@/lib/utils";

interface LoginRequiredPromptProps {
  className?: string;
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  buttonSize?: ComponentProps<typeof Button>["size"];
  buttonClassName?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

// Inner component that uses Clerk hooks (only rendered when Clerk is enabled)
function LoginRequiredPromptWithClerk({
  className,
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonClassName,
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: LoginRequiredPromptProps) {
  const { t } = useTranslation("tasks");
  const { openSignIn } = useClerk();

  const handleRedirect = useCallback(() => {
    if (onAction) {
      onAction();
      return;
    }
    openSignIn();
  }, [onAction, openSignIn]);

  const Icon = icon ?? LogIn;

  return (
    <Alert
      className={cn("flex items-start gap-3", className)}
      variant="default"
    >
      <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
      <div className="space-y-2">
        <div className="font-medium">
          {title ?? t("shareDialog.loginRequired.title")}
        </div>
        <p className="text-muted-foreground text-sm">
          {description ?? t("shareDialog.loginRequired.description")}
        </p>
        <Button
          className={cn("gap-2", buttonClassName)}
          onClick={handleRedirect}
          size={buttonSize}
          variant={buttonVariant}
        >
          <Icon className="h-4 w-4" />
          {actionLabel ?? t("shareDialog.loginRequired.action")}
        </Button>
      </div>
    </Alert>
  );
}

// Fallback component that uses the legacy OAuth flow (when Clerk is not enabled)
function LoginRequiredPromptLegacy({
  className,
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonClassName,
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: LoginRequiredPromptProps) {
  const { t } = useTranslation("tasks");

  const handleRedirect = useCallback(() => {
    if (onAction) {
      onAction();
      return;
    }
    void OAuthDialog.show();
  }, [onAction]);

  const Icon = icon ?? LogIn;

  return (
    <Alert
      className={cn("flex items-start gap-3", className)}
      variant="default"
    >
      <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
      <div className="space-y-2">
        <div className="font-medium">
          {title ?? t("shareDialog.loginRequired.title")}
        </div>
        <p className="text-muted-foreground text-sm">
          {description ?? t("shareDialog.loginRequired.description")}
        </p>
        <Button
          className={cn("gap-2", buttonClassName)}
          onClick={handleRedirect}
          size={buttonSize}
          variant={buttonVariant}
        >
          <Icon className="h-4 w-4" />
          {actionLabel ?? t("shareDialog.loginRequired.action")}
        </Button>
      </div>
    </Alert>
  );
}

export function LoginRequiredPrompt(props: LoginRequiredPromptProps) {
  const isClerkEnabled = useClerkEnabled();
  const isClerkLoaded = useClerkLoaded();

  // Only use Clerk component when enabled AND loaded
  if (isClerkEnabled && isClerkLoaded) {
    return <LoginRequiredPromptWithClerk {...props} />;
  }

  return <LoginRequiredPromptLegacy {...props} />;
}
