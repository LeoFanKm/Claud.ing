import {
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/clerk-react";
import { LogIn, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { OAuthDialog } from "@/components/dialogs/global/OAuthDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClerkEnabled } from "@/contexts/ClerkContext";
import { useLandingAuth } from "@/hooks";

// Safe wrapper for SignedIn - only renders children when Clerk is enabled AND user is signed in
export function SignedIn({ children }: { children: ReactNode }) {
  const isClerkEnabled = useClerkEnabled();

  if (!isClerkEnabled) {
    return null;
  }

  return <ClerkSignedIn>{children}</ClerkSignedIn>;
}

// Safe wrapper for SignedOut - only renders children when Clerk is enabled AND user is signed out
export function SignedOut({ children }: { children: ReactNode }) {
  const isClerkEnabled = useClerkEnabled();

  if (!isClerkEnabled) {
    return null;
  }

  return <ClerkSignedOut>{children}</ClerkSignedOut>;
}

// Internal component that uses Clerk hooks (only rendered when Clerk is loaded)
function ClerkAuthButtonsInner() {
  const { t } = useTranslation("common");
  const { isLoaded } = useAuth();

  // Show skeleton while Clerk is loading (progressive enhancement)
  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    );
  }

  return (
    <>
      <ClerkSignedOut>
        <SignInButton mode="modal">
          <Button className="gap-2" size="sm" variant="ghost">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">{t("signIn", "Sign in")}</span>
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button className="gap-2" size="sm" variant="default">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">{t("signUp", "Sign up")}</span>
          </Button>
        </SignUpButton>
      </ClerkSignedOut>
      <ClerkSignedIn>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </ClerkSignedIn>
    </>
  );
}

// Fallback auth buttons when Clerk is disabled (uses OAuth flow)
function LegacyAuthButtons() {
  const { t } = useTranslation("common");
  const { isSignedIn } = useLandingAuth();
  const navigate = useNavigate();

  const handleSignIn = useCallback(async () => {
    if (isSignedIn) {
      navigate("/projects");
      return;
    }
    const result = await OAuthDialog.show();
    if (result) {
      navigate("/projects");
    }
  }, [isSignedIn, navigate]);

  // If already signed in, don't show sign in buttons
  if (isSignedIn) {
    return null;
  }

  return (
    <>
      <Button className="gap-2" onClick={handleSignIn} size="sm" variant="ghost">
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">{t("signIn", "Sign in")}</span>
      </Button>
      <Button className="gap-2" onClick={handleSignIn} size="sm" variant="default">
        <UserPlus className="h-4 w-4" />
        <span className="hidden sm:inline">{t("signUp", "Sign up")}</span>
      </Button>
    </>
  );
}

export function ClerkAuthButtons() {
  const isClerkEnabled = useClerkEnabled();

  // If Clerk is not enabled, show legacy OAuth buttons
  if (!isClerkEnabled) {
    return <LegacyAuthButtons />;
  }

  return <ClerkAuthButtonsInner />;
}

// Internal component that uses Clerk's useUser - only rendered when Clerk is enabled
function ClerkUserProvider({
  children,
}: {
  children: (userInfo: {
    user: {
      id: string;
      email: string | undefined;
      username: string | null;
      fullName: string | null;
      imageUrl: string;
    } | null;
    isLoaded: boolean;
    isSignedIn: boolean;
  }) => ReactNode;
}) {
  const { user, isLoaded, isSignedIn } = useUser();

  return (
    <>
      {children({
        user: user
          ? {
              id: user.id,
              email: user.primaryEmailAddress?.emailAddress,
              username: user.username,
              fullName: user.fullName,
              imageUrl: user.imageUrl,
            }
          : null,
        isLoaded,
        isSignedIn: isSignedIn ?? false,
      })}
    </>
  );
}

// Safe hook that doesn't call Clerk hooks directly
// Returns a default "not signed in" state when Clerk is disabled
export function useClerkUser() {
  const isClerkEnabled = useClerkEnabled();

  // When Clerk is disabled, return safe defaults
  // The actual Clerk state is only available via ClerkUserProvider component
  if (!isClerkEnabled) {
    return {
      user: null,
      isLoaded: true,
      isSignedIn: false,
    };
  }

  // When Clerk is enabled but we can't use hooks here (would need to be in a component),
  // return a "loading" state. Components that need actual Clerk state should use
  // the ClerkUserProvider render prop pattern or check isClerkEnabled first.
  return {
    user: null,
    isLoaded: true, // Report as loaded to prevent infinite loading
    isSignedIn: false,
  };
}

// Export the provider for components that need actual Clerk user data
export { ClerkUserProvider };
